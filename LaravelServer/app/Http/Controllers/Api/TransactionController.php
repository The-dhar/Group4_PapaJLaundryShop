<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    /**
     * Managers may only act on transactions for their branch (branch_id = user id).
     * Owners may access all branches.
     */
    protected function resolveBranchIdForStore(Request $request, User $user): int
    {
        if ($user->isOwner()) {
            $validated = $request->validate([
                'branch_id' => 'required|integer|exists:users,id',
            ]);
            $branch = User::findOrFail($validated['branch_id']);
            if (! $branch->isManager()) {
                throw ValidationException::withMessages([
                    'branch_id' => ['The selected account must be a branch (manager) user.'],
                ]);
            }

            return (int) $branch->id;
        }

        return (int) $user->id;
    }

    protected function transactionForUser(User $user, int $id): Transaction
    {
        $query = Transaction::where('id', $id);
        if ($user->isManager()) {
            $query->where('branch_id', $user->id);
        }

        return $query->firstOrFail();
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
        ]);

        // get logged in branch user
        $user = $request->user();

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
            $receipt = 'RCPT-' . (10000 + Transaction::count() + 1);

            // Create transaction
            $transaction = Transaction::create([

                'receipt_number' => $receipt,

                // Branch: manager = self; owner = selected branch_id
                'branch_id' => $branchId,

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

                'due_date' => $request->due_date,

                'is_rush' => $request->is_rush ?? false,

            ]);

            // Save services
            foreach ($request->services as $service) {

                TransactionItem::create([

                    'transaction_id' => $transaction->id,
                    'service_name' => $service['serviceName'],
                    'laundry_type' => $service['laundryType'],
                    'rate' => $service['rate'],
                    'kilos' => $service['kilos'],
                    'total' => $service['total']

                ]);

            }

            DB::commit();

            return response()->json([
                'receipt' => $receipt,
                'customer_name' => $transaction->customer_name,
                'customer_middle_name' => $transaction->customer_middle_name,
                'customer_address' => $transaction->customer_address,
                'services' => $request->services,
                'amount' => $transaction->total_amount,
                'paid_amount' => $transaction->paid_amount,
                'payment_method' => $transaction->payment_method,
                'inventory_status' => $transaction->inventory_status,
                'due_date' => $transaction->due_date
            ]);

        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'error' => 'Transaction failed',
                'message' => $e->getMessage()
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
        ]);

        $query = Transaction::with([
            'items',
            'branch:id,name,clerk_username',
        ]);

        if ($user->isManager()) {
            $query->where('branch_id', $user->id);
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
                'payment_status' => $txn->payment_status,
                'inventory_status' => $txn->inventory_status,
                'due_date' => $txn->due_date,
                'archived' => (bool) $txn->archived,
                'branch_id' => $txn->branch_id,
                'branch_name' => optional($txn->branch)->name,
                'clerk_username' => optional($txn->branch)->clerk_username,
                'created_at' => $txn->created_at,
                'receipt_items' => $txn->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'serviceName' => $item->service_name,
                        'laundryType' => $item->laundry_type,
                        'rate' => $item->rate,
                        'kilos' => $item->kilos,
                        'total' => $item->total
                    ];
                })
            ];
        }));
    }

    public function markPaid(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->payment_status = 'paid';

        $transaction->save();

        return response()->json([
            'message' => 'Transaction marked as paid'
        ]);
    }

    public function updatePayment(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->paid_amount = $request->paid_amount;
        $transaction->payment_method = $request->payment_method;

        $transaction->save();

        return response()->json([
            'message' => 'Payment updated'
        ]);
    }

    public function archive(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->archived = true;

        $transaction->save();

        return response()->json([
            'message' => 'Transaction archived successfully'
        ]);
    }

    public function restore(Request $request, $id)
    {
        $transaction = $this->transactionForUser($request->user(), (int) $id);

        $transaction->archived = false;
        $transaction->save();

        return response()->json([
            'message' => 'Transaction restored successfully'
        ]);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'inventory_status' => 'nullable|in:in_shop,picked_up',
        ]);

        $transaction = $this->transactionForUser($request->user(), (int) $id);

        if (array_key_exists('inventory_status', $validated)) {
            $transaction->inventory_status = $validated['inventory_status'];
        }

        $transaction->save();

        return response()->json([
            'message' => 'Transaction updated successfully'
        ]);
    }

}