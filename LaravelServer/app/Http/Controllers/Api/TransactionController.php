<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    protected function sanitizeDateOnly($value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function sanitizeDateTime($value): ?string
    {
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Applies branch employee visibility rules to a transaction query.
     * Clerk: all transactions in current branch.
        * Staff: staff-created transactions in current branch.
     */
    protected function applyBranchEmployeeVisibility(User $user, $query, bool $failOnMissingBranch = false): void
    {
        if (! $user->isBranchEmployee()) {
            return;
        }

        if (! $user->branch_id) {
            if ($failOnMissingBranch) {
                abort(404);
            }

            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('branch_id', $user->branch_id);

        if ($user->isStaff()) {
            $query->where(function ($staffScope) use ($user) {
                $staffScope
                    ->whereHas('creator', function ($creatorQuery) {
                        $creatorQuery->where('role', 'staff');
                    })
                    // Fallback for edge cases where creator relation cannot be resolved.
                    ->orWhere('created_by_user_id', $user->id);
            });
        }
    }

    /**
     * branch_id references branches.id (not user ids).
     * Owner must send branch_id; clerk/staff use their assigned users.branch_id.
     */
    protected function resolveBranchIdForStore(Request $request, User $user): int
    {
        if ($user->isOwner()) {
            $validated = $request->validate([
                'branch_id' => 'required|integer|exists:branches,id',
            ]);

            return (int) $validated['branch_id'];
        }

        if ($user->isBranchEmployee()) {
            if (! $user->branch_id) {
                throw ValidationException::withMessages([
                    'branch_id' => ['Your account is not assigned to a branch. Ask the owner to assign one.'],
                ]);
            }

            return (int) $user->branch_id;
        }

        abort(403, 'This account cannot create transactions.');
    }

    protected function transactionForUser(User $user, int $id): Transaction
    {
        $query = Transaction::where('id', $id);

        $this->applyBranchEmployeeVisibility($user, $query, true);

        return $query->firstOrFail();
    }

    protected function suggestedPenaltyAmount(Transaction $transaction): float
    {
        if (strtolower((string) $transaction->inventory_status) !== 'in_shop') {
            return 0.0;
        }

        if (! $transaction->due_date) {
            return 0.0;
        }

        $dueDate = Carbon::parse($transaction->due_date)->startOfDay();
        $today = now()->startOfDay();
        $daysPastDue = $dueDate->diffInDays($today, false);

        if ($daysPastDue < 30) {
            return 0.0;
        }

        return round((float) $transaction->total_amount, 2);
    }

    public function store(Request $request)
    {

        $request->validate([
            'customer_name' => 'required|string',
            'customer_middle_name' => 'nullable|string|max:255',
            'customer_first_name' => 'nullable|string|max:255',
            'customer_last_name' => 'nullable|string|max:255',
            'services' => 'required|array',
            'amount' => 'required|numeric',
            'due_date' => 'required|date_format:Y-m-d|after_or_equal:today',
        ]);

        // get logged in branch user
        $user = $request->user();

        $dueDate = Carbon::createFromFormat('Y-m-d', (string) $request->input('due_date'))->startOfDay();
        $today = now()->startOfDay();
        $incomingRush = $request->boolean('is_rush');

        if ($incomingRush && ! $dueDate->equalTo($today)) {
            throw ValidationException::withMessages([
                'due_date' => ['Rush orders must have due date set to today.'],
            ]);
        }

        $isRush = $incomingRush || $dueDate->equalTo($today);

        $branchId = $this->resolveBranchIdForStore($request, $user);

        DB::beginTransaction();

        try {

            // Save customer if provided
            if ($request->customer_name) {

                $middle = $request->filled('customer_middle_name')
                    ? trim((string) $request->input('customer_middle_name'))
                    : null;
                $first = $request->filled('customer_first_name')
                    ? trim((string) $request->input('customer_first_name'))
                    : null;
                $last = $request->filled('customer_last_name')
                    ? trim((string) $request->input('customer_last_name'))
                    : null;

                Customer::create([
                    'branch_id' => $branchId,
                    'name' => $request->customer_name,
                    'address' => $request->customer_address,
                    'first_name' => $first !== '' ? $first : null,
                    'middle_name' => $middle !== '' ? $middle : null,
                    'last_name' => $last !== '' ? $last : null,
                ]);

            }

            // Generate receipt number
            $receipt = 'RCPT-'.(10000 + Transaction::count() + 1);

            // Create transaction
            $transaction = Transaction::create([

                'receipt_number' => $receipt,

                // Branch: manager = self; owner = selected branch_id
                'branch_id' => $branchId,

                // Staff/manager attribution for revenue reporting; owner POS sales stay unattributed
                'created_by_user_id' => $user->isOwner() ? null : $user->id,

                'customer_name' => $request->customer_name,
                'customer_address' => $request->customer_address,

                'total_weight' => $request->weight ?? 0,
                'subtotal' => $request->subtotal ?? 0,
                'extras' => $request->extras ?? 0,
                'total_amount' => $request->amount,

                'payment_status' => $request->payment_status,
                'payment_method' => $request->payment_method,
                'paid_amount' => $request->paid_amount ?? 0,

                'inventory_status' => 'in_shop',

                'due_date' => $dueDate->toDateString(),

                'is_rush' => $isRush,

            ]);

            // Save services
            foreach ($request->services as $service) {

                TransactionItem::create([

                    'transaction_id' => $transaction->id,
                    'service_name' => $service['serviceName'],
                    'laundry_type' => $service['laundryType'],
                    'rate' => $service['rate'],
                    'kilos' => $service['kilos'],
                    'total' => $service['total'],

                ]);

            }

            DB::commit();

            return response()->json([
                'id' => $transaction->id,
                'receipt' => $receipt,
                'customer_name' => $transaction->customer_name,
                'customer_middle_name' => $transaction->customer_middle_name,
                'customer_address' => $transaction->customer_address,
                'services' => $request->services,
                'amount' => $transaction->total_amount,
                'paid_amount' => $transaction->paid_amount,
                'penalty_amount' => (float) ($transaction->penalty_amount ?? 0),
                'penalty_suggested_amount' => (float) ($transaction->penalty_suggested_amount ?? 0),
                'penalty_override_reason' => $transaction->penalty_override_reason,
                'payment_method' => $transaction->payment_method,
                'inventory_status' => $transaction->inventory_status,
                'due_date' => $this->sanitizeDateOnly($transaction->due_date),
                'is_rush' => (bool) $transaction->is_rush,
                'created_at' => $this->sanitizeDateTime($transaction->created_at),
            ]);

        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'error' => 'Transaction failed',
                'message' => $e->getMessage(),
            ], 500);

        }

    }

    public function index(Request $request)
    {
        $user = $request->user();
        $includeArchived = $request->boolean('include_archived');

        $request->validate([
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d',
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        $query = Transaction::with([
            'items',
            'branch:id,name,clerk_username',
            'creator:id,name,first_name,last_name,role',
        ]);

        if ($user->isBranchEmployee()) {
            $this->applyBranchEmployeeVisibility($user, $query);
        } elseif ($user->isOwner() && $request->filled('branch_id')) {
            $query->where('branch_id', (int) $request->input('branch_id'));
        }

        if (! $includeArchived) {
            $query->where('archived', false);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $transactions = $query->get();

        return response()->json($transactions->map(function ($txn) {
            $creator = $txn->creator;
            $creatorName = null;

            if ($creator) {
                $first = trim((string) ($creator->first_name ?? ''));
                $last = trim((string) ($creator->last_name ?? ''));
                $full = trim($first.' '.$last);

                $creatorName = $full !== ''
                    ? $full
                    : (trim((string) ($creator->name ?? '')) !== '' ? trim((string) $creator->name) : null);
            }

            return [
                'id' => $txn->id,
                'receipt' => $txn->receipt_number,
                'customer_name' => $txn->customer_name,
                'customer_middle_name' => $txn->customer_middle_name,
                'customer_address' => $txn->customer_address,
                'amount' => $txn->total_amount,
                'subtotal' => (float) $txn->subtotal,
                'extras' => (float) $txn->extras,
                'total_weight' => $txn->total_weight,
                'is_rush' => (bool) $txn->is_rush,
                'paid_amount' => $txn->paid_amount,
                'penalty_amount' => (float) ($txn->penalty_amount ?? 0),
                'penalty_suggested_amount' => (float) ($txn->penalty_suggested_amount ?? 0),
                'penalty_override_reason' => $txn->penalty_override_reason,
                // Legacy alias kept for existing web pages that still read `penalty`.
                'penalty' => (float) ($txn->penalty_amount ?? 0),
                'payment_status' => $txn->payment_status,
                'payment_method' => $txn->payment_method,
                'inventory_status' => $txn->inventory_status,
                'due_date' => $this->sanitizeDateOnly($txn->due_date),
                'archived' => (bool) $txn->archived,
                'branch_id' => $txn->branch_id,
                'branch_name' => optional($txn->branch)->name,
                'clerk_username' => optional($txn->branch)->clerk_username,
                'created_by_user_id' => $txn->created_by_user_id,
                'created_by_name' => $creatorName,
                'created_by_role' => $creator?->role,
                'created_at' => $this->sanitizeDateTime($txn->created_at),
                'receipt_items' => $txn->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'serviceName' => $item->service_name,
                        'laundryType' => $item->laundry_type,
                        'rate' => $item->rate,
                        'kilos' => $item->kilos,
                        'total' => $item->total,
                    ];
                }),
            ];
        }));
    }

    public function markPaid(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $suggestedPenalty = $this->suggestedPenaltyAmount($transaction);
        $appliedPenalty = round((float) ($transaction->penalty_amount ?? 0), 2);
        $overrideReason = trim((string) ($transaction->penalty_override_reason ?? ''));

        if ($appliedPenalty + 0.001 < $suggestedPenalty && $overrideReason === '') {
            throw ValidationException::withMessages([
                'penalty_override_reason' => ['A reason is required when the penalty is below the suggested amount.'],
            ]);
        }

        $requiredTotal = round((float) $transaction->total_amount + $appliedPenalty, 2);

        if ((float) $transaction->paid_amount + 0.001 < $requiredTotal) {
            throw ValidationException::withMessages([
                'paid_amount' => ["Paid amount must be at least {$requiredTotal} before marking this transaction as paid."],
            ]);
        }

        $transaction->payment_status = 'paid';
        $transaction->penalty_suggested_amount = $suggestedPenalty;

        $transaction->save();

        return response()->json([
            'message' => 'Transaction marked as paid',
        ]);
    }

    public function updatePayment(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $validated = $request->validate([
            'paid_amount' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string|max:50',
            'penalty_amount' => 'nullable|numeric|min:0',
            // Backward compatible with existing clients still sending `penalty`.
            'penalty' => 'nullable|numeric|min:0',
            'penalty_override_reason' => 'nullable|string|max:500',
        ]);

        $paidAmount = round((float) $validated['paid_amount'], 2);
        $incomingPenalty = $validated['penalty_amount']
            ?? $validated['penalty']
            ?? $transaction->penalty_amount
            ?? 0;
        $appliedPenalty = round((float) $incomingPenalty, 2);
        $suggestedPenalty = $this->suggestedPenaltyAmount($transaction);
        $overrideReason = trim((string) ($validated['penalty_override_reason'] ?? ''));

        if ($appliedPenalty + 0.001 < $suggestedPenalty && $overrideReason === '') {
            throw ValidationException::withMessages([
                'penalty_override_reason' => ['A reason is required when the penalty is below the suggested amount.'],
            ]);
        }

        $transaction->paid_amount = $paidAmount;
        $transaction->payment_method = $validated['payment_method'] ?? $transaction->payment_method;
        $transaction->penalty_amount = $appliedPenalty;
        $transaction->penalty_suggested_amount = $suggestedPenalty;
        $transaction->penalty_override_reason = $appliedPenalty + 0.001 < $suggestedPenalty
            ? $overrideReason
            : null;

        $transaction->save();

        return response()->json([
            'message' => 'Payment updated',
            'transaction' => [
                'id' => $transaction->id,
                'paid_amount' => (float) $transaction->paid_amount,
                'penalty_amount' => (float) $transaction->penalty_amount,
                'penalty_suggested_amount' => (float) ($transaction->penalty_suggested_amount ?? 0),
                'penalty_override_reason' => $transaction->penalty_override_reason,
            ],
        ]);
    }

    public function archive(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->archived = true;

        $transaction->save();

        return response()->json([
            'message' => 'Transaction archived successfully',
        ]);
    }

    public function restore(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->archived = false;
        $transaction->save();

        return response()->json([
            'message' => 'Transaction restored successfully',
        ]);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'inventory_status' => 'nullable|in:in_shop,picked_up,backjob',
        ]);

        $transaction = $this->transactionForUser($request->user(), (int) $id);

        if (array_key_exists('inventory_status', $validated)) {
            $transaction->inventory_status = $validated['inventory_status'];
        }

        $transaction->save();

        return response()->json([
            'message' => 'Transaction updated successfully',
        ]);
    }
}
