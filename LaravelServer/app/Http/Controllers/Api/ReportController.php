<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Backjob;
use App\Models\IssueReport;
use App\Models\ReportActivityLog;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    private const ISSUE_TYPES = [
        'damaged',
        'lost',
        'poor_quality_cleaning',
        'wrinkled_not_folded_well',
        'other',
    ];
    private const ISSUE_OPEN_STATUSES = ['pending', 'under_review'];
    private const ISSUE_RESOLVABLE_STATUSES = ['pending', 'under_review'];
    private const ISSUE_RESOLUTION_TYPES = ['refund', 'replacement'];

    private const BACKJOB_OPEN_STATUSES = ['pending', 'approved', 'in_progress'];

    public function listAssignableEmployees(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canCreateCase($user)) {
            return response()->json(['message' => 'Only owner, clerk, or staff can create reports.'], 403);
        }

        $validated = $request->validate([
            'transaction_id' => 'required|integer|exists:transactions,id',
        ]);

        $transaction = $this->reportableTransactionForUser($user, (int) $validated['transaction_id']);
        $allowedRoles = $this->assignableRolesForCreator($user);

        $rows = User::query()
            ->where('branch_id', $transaction->branch_id)
            ->whereIn('role', $allowedRoles)
            ->where('is_active', true)
            ->orderBy('role')
            ->orderBy('name')
            ->get(['id', 'name', 'first_name', 'last_name', 'role', 'branch_id']);

        return response()->json($rows->map(function (User $employee) {
            return [
                'id' => $employee->id,
                'name' => $this->displayName($employee),
                'role' => $employee->role,
                'branch_id' => $employee->branch_id,
            ];
        })->values());
    }

    public function listEscalationClerks(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isStaff()) {
            return response()->json(['message' => 'Only staff can escalate reports to clerk.'], 403);
        }

        $validated = $request->validate([
            'transaction_id' => 'required|integer|exists:transactions,id',
        ]);

        $transaction = $this->reportableTransactionForUser($user, (int) $validated['transaction_id']);

        $rows = User::query()
            ->where('branch_id', $transaction->branch_id)
            ->where('role', 'clerk')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'first_name', 'last_name', 'role', 'branch_id']);

        return response()->json($rows->map(function (User $employee) {
            return [
                'id' => $employee->id,
                'name' => $this->displayName($employee),
                'role' => $employee->role,
                'branch_id' => $employee->branch_id,
            ];
        })->values());
    }

    public function listIssueReports(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'status' => 'nullable|string|max:32',
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        $query = IssueReport::query()->with([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        $this->applyIssueVisibility($user, $query);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('branch_id') && $this->canViewAllBranches($user)) {
            $query->where('branch_id', (int) $request->input('branch_id'));
        }

        $rows = $query->orderByDesc('id')->get();

        return response()->json($rows->map(fn (IssueReport $row) => $this->serializeIssueReport($row))->values());
    }

    public function createIssueReport(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canCreateCase($user)) {
            return response()->json(['message' => 'Only owner, clerk, or staff can create reports.'], 403);
        }

        $validated = $request->validate([
            'transaction_id' => 'required|integer|exists:transactions,id',
            'transaction_item_id' => 'required|integer|exists:transaction_items,id',
            'affected_transaction_item_ids' => 'nullable|array',
            'affected_transaction_item_ids.*' => 'integer|exists:transaction_items,id',
            'issue_type' => 'required|string|in:damaged,lost,poor_quality_cleaning,wrinkled_not_folded_well,other',
            'issue_note' => 'nullable|string|max:2000',
            'assigned_employee_user_id' => 'nullable|integer|exists:users,id',
        ]);

        if ($validated['issue_type'] === 'other' && trim((string) ($validated['issue_note'] ?? '')) === '') {
            throw ValidationException::withMessages([
                'issue_note' => ['Please provide details when issue type is other.'],
            ]);
        }

        $transaction = $this->reportableTransactionForUser($user, (int) $validated['transaction_id']);
        $this->assertPaidTransaction($transaction);

        if (IssueReport::query()->where('transaction_id', $transaction->id)->exists()) {
            throw ValidationException::withMessages([
                'transaction_id' => ['A report already exists for this transaction. Only one report per transaction is allowed.'],
            ]);
        }

        $lineItemId = (int) $validated['transaction_item_id'];
        $line = TransactionItem::query()
            ->whereKey($lineItemId)
            ->where('transaction_id', $transaction->id)
            ->first();

        if (! $line) {
            throw ValidationException::withMessages([
                'transaction_item_id' => ['The selected line does not belong to this transaction.'],
            ]);
        }

        $affectedIds = ! empty($validated['affected_transaction_item_ids'])
            ? array_values(array_unique(array_map('intval', $validated['affected_transaction_item_ids'])))
            : [$lineItemId];

        foreach ($affectedIds as $aid) {
            $belongs = TransactionItem::query()
                ->whereKey($aid)
                ->where('transaction_id', $transaction->id)
                ->exists();
            if (! $belongs) {
                throw ValidationException::withMessages([
                    'affected_transaction_item_ids' => ["Service line {$aid} does not belong to this transaction."],
                ]);
            }
        }

        if (! in_array($lineItemId, $affectedIds, true)) {
            throw ValidationException::withMessages([
                'transaction_item_id' => ['Primary line must be included in affected service lines.'],
            ]);
        }

        /**
         * Option 2 policy: one primary issue_type + issue_note for multi-line / mixed cases.
         * If the receipt has multiple line items and type is Damaged or Lost, require a note
         * explaining which line(s) are affected (and mixed damage vs loss on other lines).
         */
        $lineCount = TransactionItem::query()
            ->where('transaction_id', $transaction->id)
            ->count();

        $issueTypeNorm = strtolower(trim((string) $validated['issue_type']));
        $noteTrim = trim((string) ($validated['issue_note'] ?? ''));

        if ($lineCount > 1 && in_array($issueTypeNorm, ['damaged', 'lost'], true) && $noteTrim === '') {
            throw ValidationException::withMessages([
                'issue_note' => ['This receipt has multiple service lines. Enter an issue note describing which line(s) are affected, quantities, and—if damage and loss involve different lines—which applies where (see shop policy for primary type).'],
            ]);
        }

        if (! empty($validated['assigned_employee_user_id'])) {
            $assignedEmployee = $this->branchEmployeeForTransaction(
                (int) $validated['assigned_employee_user_id'],
                (int) $transaction->branch_id,
                $this->assignableRolesForCreator($user)
            );
        } else {
            $assignedEmployee = $this->defaultAssignedEmployeeForTransaction($user, $transaction);
        }

        $report = IssueReport::create([
            'transaction_id' => $transaction->id,
            'transaction_item_id' => $lineItemId,
            'affected_transaction_item_ids' => $affectedIds,
            'branch_id' => $transaction->branch_id,
            'reported_by_user_id' => $user->id,
            'assigned_employee_user_id' => $assignedEmployee->id,
            'issue_type' => strtolower(trim((string) $validated['issue_type'])),
            'issue_note' => trim((string) ($validated['issue_note'] ?? '')) ?: null,
            'status' => 'pending',
        ]);

        $this->logActivity('issue_report', $report->id, 'created', null, 'pending', $user->id, null, [
            'transaction_id' => $transaction->id,
            'transaction_item_id' => $lineItemId,
            'issue_type' => $report->issue_type,
        ]);

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeIssueReport($report), 201);
    }

    public function escalateIssueReport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user->isStaff()) {
            return response()->json(['message' => 'Only staff can escalate issue reports.'], 403);
        }

        $validated = $request->validate([
            'clerk_user_id' => 'required|integer|exists:users,id',
        ]);

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, self::ISSUE_OPEN_STATUSES, true)) {
            return response()->json(['message' => 'Only pending or under_review reports can be escalated.'], 422);
        }

        if ((int) $report->assigned_employee_user_id !== (int) $user->id) {
            return response()->json(['message' => 'You can only escalate reports assigned to you.'], 403);
        }

        $clerk = $this->branchEmployeeForTransaction(
            (int) $validated['clerk_user_id'],
            (int) $report->branch_id,
            ['clerk'],
            'clerk_user_id'
        );

        if ((int) $report->assigned_employee_user_id === (int) $clerk->id) {
            return response()->json(['message' => 'This report is already assigned to the selected clerk.'], 422);
        }

        $oldAssigneeId = (int) $report->assigned_employee_user_id;
        $report->assigned_employee_user_id = $clerk->id;
        $report->save();

        $this->logActivity('issue_report', $report->id, 'escalated_to_clerk', $report->status, $report->status, $user->id, null, [
            'from_assigned_employee_user_id' => $oldAssigneeId,
            'to_assigned_employee_user_id' => $clerk->id,
        ]);

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeIssueReport($report));
    }

    public function markIssueUnderReview(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $this->canResolveCase($user)) {
            return response()->json(['message' => 'Only owner or clerk can resolve reports.'], 403);
        }

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, ['pending'], true)) {
            return response()->json(['message' => 'Only pending reports can be moved to under_review.'], 422);
        }

        $oldStatus = $report->status;
        $report->status = 'under_review';
        $report->save();

        $this->logActivity('issue_report', $report->id, 'status_changed', $oldStatus, $report->status, $user->id);

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeIssueReport($report));
    }

    public function resolveIssueReport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $this->canResolveCase($user)) {
            return response()->json(['message' => 'Only owner or clerk can resolve reports.'], 403);
        }

        $validated = $request->validate([
            'resolution_type' => 'required|string|in:refund,replacement',
            'resolution_note' => 'required|string|min:1|max:2000',
        ]);

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, self::ISSUE_RESOLVABLE_STATUSES, true)) {
            return response()->json(['message' => 'Only pending or under_review reports can be resolved.'], 422);
        }

        $resolutionType = strtolower(trim((string) $validated['resolution_type']));

        $refundAmount = null;
        $refundAllocationsStored = null;
        if ($resolutionType === 'refund') {
            $affected = $this->affectedIdsForReport($report);
            if (count($affected) === 0) {
                throw ValidationException::withMessages([
                    'refund_amount' => ['This dispute has no linked service lines; refund resolution is not available.'],
                ]);
            }

            if (count($affected) > 1) {
                $request->validate([
                    'refund_allocations' => 'required|array|min:1',
                    'refund_allocations.*.transaction_item_id' => 'required|integer',
                    'refund_allocations.*.amount' => 'required|numeric|min:0',
                ]);
                $result = $this->validateRefundAllocationsForResolve($report, $request->input('refund_allocations', []));
                $refundAmount = $result['total'];
                $refundAllocationsStored = $result['allocations'];
            } elseif ($request->filled('refund_allocations') && is_array($request->input('refund_allocations'))) {
                $result = $this->validateRefundAllocationsForResolve($report, $request->input('refund_allocations', []));
                $refundAmount = $result['total'];
                $refundAllocationsStored = $result['allocations'];
            } else {
                $request->validate([
                    'refund_amount' => 'required|numeric|min:0.01',
                ]);
                $refundAmount = round((float) $request->input('refund_amount'), 2);
                $onlyId = (int) $affected[0];
                $this->assertSingleLineRefundWithinCap($report, $onlyId, $refundAmount);
                $refundAllocationsStored = [
                    ['transaction_item_id' => $onlyId, 'amount' => $refundAmount],
                ];
            }
        } elseif ($request->filled('refund_amount') || $request->filled('refund_allocations')) {
            throw ValidationException::withMessages([
                'refund_amount' => ['Refund fields are only used when resolution type is refund.'],
            ]);
        }

        $oldStatus = $report->status;
        $report->status = 'resolved';
        $report->resolution_type = $resolutionType;
        $report->resolution_note = trim((string) ($validated['resolution_note'] ?? '')) ?: null;
        $report->refund_amount = $refundAmount;
        $report->refund_allocations = $refundAllocationsStored;
        $report->resolved_by_user_id = $user->id;
        $report->resolved_at = now();
        $report->save();

        $this->logActivity(
            'issue_report',
            $report->id,
            $report->resolution_type === 'refund' ? 'resolved_refund' : 'resolved_replacement',
            $oldStatus,
            $report->status,
            $user->id,
            $report->resolution_note
        );

        $createdBackjob = null;
        if ($report->resolution_type === 'replacement') {
            $createdBackjob = $this->createReplacementBackjobIfMissing($report, $user);
            if ($createdBackjob) {
                // Backjob flow: keep dispute row, and tag source transaction as backjob in Transaction Log.
                Transaction::query()
                    ->whereKey($report->transaction_id)
                    ->update(['inventory_status' => 'backjob']);
            }
        }

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        return response()->json([
            'issue_report' => $this->serializeIssueReport($report),
            'created_backjob' => $createdBackjob ? $this->serializeBackjob($createdBackjob) : null,
        ]);
    }

    public function rejectIssueReport(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $this->canResolveCase($user)) {
            return response()->json(['message' => 'Only owner or clerk can resolve reports.'], 403);
        }

        $validated = $request->validate([
            'resolution_note' => 'required|string|min:1|max:2000',
        ]);

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, self::ISSUE_RESOLVABLE_STATUSES, true)) {
            return response()->json(['message' => 'Only pending or under_review reports can be rejected.'], 422);
        }

        $oldStatus = $report->status;
        $report->status = 'rejected';
        $report->resolution_type = null;
        $report->resolution_note = trim((string) ($validated['resolution_note'] ?? '')) ?: null;
        $report->refund_amount = null;
        $report->refund_allocations = null;
        $report->resolved_by_user_id = $user->id;
        $report->resolved_at = now();
        $report->save();

        $this->logActivity(
            'issue_report',
            $report->id,
            'rejected',
            $oldStatus,
            $report->status,
            $user->id,
            $report->resolution_note
        );

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'transactionItem:id,transaction_id,service_name,laundry_type,rate,kilos,total,piece_count',
            'branch:id,name',
            'reporter:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'resolver:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeIssueReport($report));
    }

    public function listBackjobs(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'status' => 'nullable|string|max:32',
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        $query = Backjob::query()->with([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'issueReport:id,issue_type,status,transaction_id',
            'branch:id,name',
            'creator:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'approver:id,name,first_name,last_name,role',
            'completer:id,name,first_name,last_name,role',
        ]);

        $this->applyBackjobVisibility($user, $query);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('branch_id') && $this->canViewAllBranches($user)) {
            $query->where('branch_id', (int) $request->input('branch_id'));
        }

        $rows = $query->orderByDesc('id')->get();

        return response()->json($rows->map(fn (Backjob $row) => $this->serializeBackjob($row))->values());
    }

    public function createBackjob(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canCreateCase($user)) {
            return response()->json(['message' => 'Only owner, clerk, or staff can create backjobs.'], 403);
        }

        $validated = $request->validate([
            'transaction_id' => 'required|integer|exists:transactions,id',
            'issue_report_id' => 'nullable|integer|exists:issue_reports,id',
            'assigned_employee_user_id' => 'nullable|integer|exists:users,id',
            'reason_note' => 'nullable|string|max:2000',
        ]);

        $transaction = $this->reportableTransactionForUser($user, (int) $validated['transaction_id']);
        $this->assertPaidTransaction($transaction);
        $this->assertNoOpenBackjob((int) $transaction->id);

        if (! empty($validated['assigned_employee_user_id'])) {
            $assignedEmployee = $this->branchEmployeeForTransaction(
                (int) $validated['assigned_employee_user_id'],
                (int) $transaction->branch_id,
                $this->assignableRolesForCreator($user)
            );
        } else {
            $assignedEmployee = $this->defaultAssignedEmployeeForTransaction($user, $transaction);
        }

        $issueReportId = null;
        if (! empty($validated['issue_report_id'])) {
            $issue = $this->issueReportForUser($user, (int) $validated['issue_report_id'], true);
            if ((int) $issue->transaction_id !== (int) $transaction->id) {
                throw ValidationException::withMessages([
                    'issue_report_id' => ['The selected issue report does not belong to the transaction.'],
                ]);
            }
            $issueReportId = $issue->id;
        }

        $backjob = Backjob::create([
            'transaction_id' => $transaction->id,
            'issue_report_id' => $issueReportId,
            'branch_id' => $transaction->branch_id,
            'created_by_user_id' => $user->id,
            'assigned_employee_user_id' => $assignedEmployee->id,
            'reason_note' => trim((string) ($validated['reason_note'] ?? '')) ?: null,
            'status' => 'pending',
            'is_free_redo' => true,
        ]);

        $this->logActivity('backjob', $backjob->id, 'created', null, 'pending', $user->id, $backjob->reason_note, [
            'transaction_id' => $transaction->id,
            'issue_report_id' => $issueReportId,
        ]);

        $backjob->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'issueReport:id,issue_type,status,transaction_id',
            'branch:id,name',
            'creator:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'approver:id,name,first_name,last_name,role',
            'completer:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeBackjob($backjob), 201);
    }

    public function escalateBackjob(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user->isStaff()) {
            return response()->json(['message' => 'Only staff can escalate backjobs.'], 403);
        }

        $validated = $request->validate([
            'clerk_user_id' => 'required|integer|exists:users,id',
        ]);

        $backjob = $this->backjobForUser($user, $id, true);

        if (! in_array($backjob->status, self::BACKJOB_OPEN_STATUSES, true)) {
            return response()->json(['message' => 'Only open backjobs can be escalated.'], 422);
        }

        if ((int) $backjob->assigned_employee_user_id !== (int) $user->id) {
            return response()->json(['message' => 'You can only escalate backjobs assigned to you.'], 403);
        }

        $clerk = $this->branchEmployeeForTransaction(
            (int) $validated['clerk_user_id'],
            (int) $backjob->branch_id,
            ['clerk'],
            'clerk_user_id'
        );

        if ((int) $backjob->assigned_employee_user_id === (int) $clerk->id) {
            return response()->json(['message' => 'This backjob is already assigned to the selected clerk.'], 422);
        }

        $oldAssigneeId = (int) $backjob->assigned_employee_user_id;
        $backjob->assigned_employee_user_id = $clerk->id;
        $backjob->save();

        $this->logActivity('backjob', $backjob->id, 'escalated_to_clerk', $backjob->status, $backjob->status, $user->id, null, [
            'from_assigned_employee_user_id' => $oldAssigneeId,
            'to_assigned_employee_user_id' => $clerk->id,
        ]);

        $backjob->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'issueReport:id,issue_type,status,transaction_id',
            'branch:id,name',
            'creator:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'approver:id,name,first_name,last_name,role',
            'completer:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeBackjob($backjob));
    }

    public function approveBackjob(Request $request, int $id): JsonResponse
    {
        return $this->transitionBackjob($request, $id, 'approved', ['pending'], 'approved', true, false);
    }

    public function startBackjob(Request $request, int $id): JsonResponse
    {
        return $this->transitionBackjob($request, $id, 'in_progress', ['approved'], 'started', false, false);
    }

    public function completeBackjob(Request $request, int $id): JsonResponse
    {
        return $this->transitionBackjob($request, $id, 'completed', ['in_progress'], 'completed', false, true);
    }

    public function cancelBackjob(Request $request, int $id): JsonResponse
    {
        return $this->transitionBackjob($request, $id, 'cancelled', ['pending', 'approved', 'in_progress'], 'cancelled', false, false);
    }

    protected function transitionBackjob(
        Request $request,
        int $id,
        string $nextStatus,
        array $allowedFrom,
        string $action,
        bool $touchApproval,
        bool $touchCompletion
    ): JsonResponse {
        $user = $request->user();
        if (! $this->canResolveCase($user)) {
            return response()->json(['message' => 'Only owner or clerk can resolve backjobs.'], 403);
        }

        $validated = $request->validate([
            'reason_note' => 'nullable|string|max:2000',
        ]);

        $row = $this->backjobForUser($user, $id, true);

        if (! in_array($row->status, $allowedFrom, true)) {
            return response()->json([
                'message' => 'Invalid status transition from '.$row->status.' to '.$nextStatus.'.',
            ], 422);
        }

        $oldStatus = $row->status;
        $row->status = $nextStatus;

        $incomingNote = trim((string) ($validated['reason_note'] ?? '')) ?: null;
        if ($incomingNote !== null) {
            $row->reason_note = $incomingNote;
        }

        if ($touchApproval) {
            $row->approved_by_user_id = $user->id;
            $row->approved_at = now();
        }

        if ($touchCompletion) {
            $row->completed_by_user_id = $user->id;
            $row->completed_at = now();
        }

        $row->save();

        $this->logActivity('backjob', $row->id, $action, $oldStatus, $row->status, $user->id, $incomingNote);

        $row->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'issueReport:id,issue_type,status,transaction_id',
            'branch:id,name',
            'creator:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'approver:id,name,first_name,last_name,role',
            'completer:id,name,first_name,last_name,role',
        ]);

        return response()->json($this->serializeBackjob($row));
    }

    protected function createReplacementBackjobIfMissing(IssueReport $report, User $actor): ?Backjob
    {
        $existingOpen = Backjob::query()
            ->where('transaction_id', $report->transaction_id)
            ->whereIn('status', self::BACKJOB_OPEN_STATUSES)
            ->first();

        if ($existingOpen) {
            return null;
        }

        $backjob = Backjob::create([
            'transaction_id' => $report->transaction_id,
            'issue_report_id' => $report->id,
            'branch_id' => $report->branch_id,
            'created_by_user_id' => $actor->id,
            'assigned_employee_user_id' => $report->assigned_employee_user_id,
            'reason_note' => $report->resolution_note ?: $report->issue_note,
            'status' => 'pending',
            'is_free_redo' => true,
        ]);

        $this->logActivity('backjob', $backjob->id, 'created', null, 'pending', $actor->id, $backjob->reason_note, [
            'source' => 'issue_report_resolution',
            'issue_report_id' => $report->id,
        ]);

        $backjob->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
            'issueReport:id,issue_type,status,transaction_id',
            'branch:id,name',
            'creator:id,name,first_name,last_name,role,branch_id',
            'assignedEmployee:id,name,first_name,last_name,role,branch_id',
            'approver:id,name,first_name,last_name,role',
            'completer:id,name,first_name,last_name,role',
        ]);

        return $backjob;
    }

    protected function issueReportForUser(User $user, int $id, bool $failOnMissingBranch): IssueReport
    {
        $query = IssueReport::query()->where('id', $id);
        $this->applyIssueVisibility($user, $query, $failOnMissingBranch);

        return $query->firstOrFail();
    }

    protected function backjobForUser(User $user, int $id, bool $failOnMissingBranch): Backjob
    {
        $query = Backjob::query()->where('id', $id);
        $this->applyBackjobVisibility($user, $query, $failOnMissingBranch);

        return $query->firstOrFail();
    }

    protected function applyIssueVisibility(User $user, Builder $query, bool $failOnMissingBranch = false): void
    {
        if ($this->canViewAllBranches($user)) {
            return;
        }

        if (! $user->isBranchEmployee()) {
            abort(403, 'This account cannot access issue reports.');
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
            $query->where(function (Builder $staffScope) use ($user) {
                $staffScope
                    ->whereHas('reporter', function (Builder $reporterQuery) {
                        $reporterQuery->where('role', 'staff');
                    })
                    ->orWhere('reported_by_user_id', $user->id)
                    ->orWhere('assigned_employee_user_id', $user->id);
            });
        }
    }

    protected function applyBackjobVisibility(User $user, Builder $query, bool $failOnMissingBranch = false): void
    {
        if ($this->canViewAllBranches($user)) {
            return;
        }

        if (! $user->isBranchEmployee()) {
            abort(403, 'This account cannot access backjobs.');
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
            $query->where(function (Builder $staffScope) use ($user) {
                $staffScope
                    ->whereHas('creator', function (Builder $creatorQuery) {
                        $creatorQuery->where('role', 'staff');
                    })
                    ->orWhere('created_by_user_id', $user->id)
                    ->orWhere('assigned_employee_user_id', $user->id);
            });
        }
    }

    protected function reportableTransactionForUser(User $user, int $transactionId): Transaction
    {
        $query = Transaction::query()->where('id', $transactionId);
        $this->applyTransactionVisibility($user, $query, true);

        return $query->firstOrFail();
    }

    protected function applyTransactionVisibility(User $user, Builder $query, bool $failOnMissingBranch = false): void
    {
        if ($this->canViewAllBranches($user)) {
            return;
        }

        if (! $user->isBranchEmployee()) {
            abort(403, 'This account cannot access transactions.');
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
            $query->where(function (Builder $staffScope) use ($user) {
                $staffScope
                    ->whereHas('creator', function (Builder $creatorQuery) {
                        $creatorQuery->where('role', 'staff');
                    })
                    ->orWhere('created_by_user_id', $user->id);
            });
        }
    }

    /**
     * First active branch employee matching assignable roles (same ordering as listAssignableEmployees).
     * Used when the client omits assigned_employee_user_id.
     */
    protected function defaultAssignedEmployeeForTransaction(User $creator, Transaction $transaction): User
    {
        $allowedRoles = $this->assignableRolesForCreator($creator);
        $employee = User::query()
            ->where('branch_id', $transaction->branch_id)
            ->whereIn('role', $allowedRoles)
            ->where('is_active', true)
            ->orderBy('role')
            ->orderBy('name')
            ->first();

        if (! $employee) {
            throw ValidationException::withMessages([
                'assigned_employee_user_id' => ['No active clerk or staff is available for this branch to assign.'],
            ]);
        }

        return $employee;
    }

    protected function branchEmployeeForTransaction(
        int $userId,
        int $branchId,
        array $allowedRoles,
        string $validationField = 'assigned_employee_user_id'
    ): User
    {
        $employee = User::query()->whereKey($userId)->firstOrFail();
        $normalizedRoles = array_values(array_unique(array_map(
            fn ($role) => strtolower(trim((string) $role)),
            $allowedRoles
        )));

        if (empty($normalizedRoles)) {
            throw ValidationException::withMessages([
                $validationField => ['No assignable roles are available for this request.'],
            ]);
        }

        $roleLabels = implode(' or ', $normalizedRoles);

        if (! in_array(strtolower((string) $employee->role), $normalizedRoles, true)) {
            throw ValidationException::withMessages([
                $validationField => ['Selected user must be a '.$roleLabels.' account.'],
            ]);
        }

        if ((int) ($employee->branch_id ?? 0) !== $branchId) {
            throw ValidationException::withMessages([
                $validationField => ['Selected user must belong to the same branch as the transaction.'],
            ]);
        }

        return $employee;
    }

    protected function assignableRolesForCreator(User $user): array
    {
        if ($user->isStaff()) {
            return ['staff'];
        }

        if ($user->isOwner() || $user->isManager() || $user->isClerk()) {
            return ['clerk', 'staff'];
        }

        return [];
    }

    protected function assertPaidTransaction(Transaction $transaction): void
    {
        if (strtolower((string) $transaction->payment_status) !== 'paid') {
            throw ValidationException::withMessages([
                'transaction_id' => ['Only paid transactions can be reported or used for backjob creation.'],
            ]);
        }
    }

    protected function assertNoOpenBackjob(int $transactionId): void
    {
        $exists = Backjob::query()
            ->where('transaction_id', $transactionId)
            ->whereIn('status', self::BACKJOB_OPEN_STATUSES)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'transaction_id' => ['This transaction already has an open backjob.'],
            ]);
        }
    }

    protected function canCreateCase(User $user): bool
    {
        return $user->isOwner() || $user->isManager() || $user->isClerk() || $user->isStaff();
    }

    protected function canResolveCase(User $user): bool
    {
        return $user->isOwner() || $user->isManager() || $user->isClerk();
    }

    protected function canViewAllBranches(User $user): bool
    {
        return $user->isOwner() || $user->isManager();
    }

    protected function logActivity(
        string $entityType,
        int $entityId,
        string $action,
        ?string $oldStatus,
        ?string $newStatus,
        ?int $actorUserId,
        ?string $note = null,
        ?array $metadata = null
    ): void {
        ReportActivityLog::create([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'actor_user_id' => $actorUserId,
            'note' => $note,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }

    /**
     * Legacy single-field refund: one affected line, cap checked against that line's remaining refundable amount.
     */
    protected function assertSingleLineRefundWithinCap(IssueReport $report, int $transactionItemId, float $amount): void
    {
        $remaining = $this->refundableRemainingForLineItem($transactionItemId, $report->id, (int) $report->transaction_id);

        if ($amount < 0.01) {
            throw ValidationException::withMessages([
                'refund_amount' => ['Refund amount must be at least 0.01.'],
            ]);
        }

        if ($amount - 0.001 > $remaining) {
            throw ValidationException::withMessages([
                'refund_amount' => ["Refund cannot exceed the remaining refundable amount for this line (max {$remaining})."],
            ]);
        }
    }

    /**
     * @return array{total: float, allocations: array<int, array{transaction_item_id: int, amount: float}>}
     */
    protected function validateRefundAllocationsForResolve(IssueReport $report, array $allocationsInput): array
    {
        $affected = $this->affectedIdsForReport($report);

        $byLine = [];
        foreach ($allocationsInput as $row) {
            $tid = (int) ($row['transaction_item_id'] ?? 0);
            $amt = round((float) ($row['amount'] ?? 0), 2);
            if ($tid <= 0) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ['Each allocation must include a valid transaction_item_id.'],
                ]);
            }
            if ($amt < 0) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ['Allocation amounts cannot be negative.'],
                ]);
            }
            if (isset($byLine[$tid])) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ['Duplicate transaction_item_id in refund allocations.'],
                ]);
            }
            $byLine[$tid] = $amt;
        }

        foreach ($affected as $id) {
            if (! array_key_exists($id, $byLine)) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ["Include an amount for each affected service line (missing line ID {$id})."],
                ]);
            }
        }

        foreach (array_keys($byLine) as $tid) {
            if (! in_array($tid, $affected, true)) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ['Allocation includes a line that is not part of this dispute.'],
                ]);
            }
        }

        $total = round(array_sum($byLine), 2);
        if ($total < 0.01) {
            throw ValidationException::withMessages([
                'refund_allocations' => ['Total refund must be at least 0.01.'],
            ]);
        }

        foreach ($byLine as $tid => $amt) {
            $remaining = $this->refundableRemainingForLineItem((int) $tid, $report->id, (int) $report->transaction_id);
            if ($amt - 0.001 > $remaining) {
                throw ValidationException::withMessages([
                    'refund_allocations' => ["Refund for line {$tid} cannot exceed {$remaining} (remaining for this line)."],
                ]);
            }
        }

        $normalized = [];
        foreach ($affected as $tid) {
            $normalized[] = [
                'transaction_item_id' => $tid,
                'amount' => $byLine[$tid],
            ];
        }

        return ['total' => $total, 'allocations' => $normalized];
    }

    /** @return int[] */
    protected function affectedIdsForReport(IssueReport $report): array
    {
        $raw = $report->affected_transaction_item_ids;
        if (is_array($raw) && count($raw) > 0) {
            return array_values(array_unique(array_map('intval', $raw)));
        }
        if ($report->transaction_item_id) {
            return [(int) $report->transaction_item_id];
        }

        return [];
    }

    protected function priorRefundAmountAllocatedToLine(int $transactionItemId, int $excludeIssueReportId, int $transactionId): float
    {
        $reports = IssueReport::query()
            ->where('transaction_id', $transactionId)
            ->where('status', 'resolved')
            ->where('resolution_type', 'refund')
            ->where('id', '!=', $excludeIssueReportId)
            ->get(['id', 'transaction_item_id', 'refund_amount', 'refund_allocations']);

        $sum = 0.0;
        foreach ($reports as $r) {
            $sum += $this->priorRefundAmountForLineFromReport($r, $transactionItemId);
        }

        return round($sum, 2);
    }

    protected function priorRefundAmountForLineFromReport(IssueReport $r, int $transactionItemId): float
    {
        $alloc = $r->refund_allocations;
        if (is_array($alloc) && count($alloc) > 0) {
            foreach ($alloc as $row) {
                if ((int) ($row['transaction_item_id'] ?? 0) === $transactionItemId) {
                    return round((float) ($row['amount'] ?? 0), 2);
                }
            }

            return 0.0;
        }

        if ((int) $r->transaction_item_id === $transactionItemId && $r->refund_amount !== null) {
            return round((float) $r->refund_amount, 2);
        }

        return 0.0;
    }

    protected function refundableRemainingForLineItem(int $transactionItemId, int $excludeIssueReportId, int $transactionId): float
    {
        $line = TransactionItem::query()
            ->whereKey($transactionItemId)
            ->where('transaction_id', $transactionId)
            ->first();

        if (! $line) {
            return 0.0;
        }

        $lineTotal = round((float) $line->total, 2);
        $prior = $this->priorRefundAmountAllocatedToLine($transactionItemId, $excludeIssueReportId, $transactionId);

        return max(0, round($lineTotal - $prior, 2));
    }

    /** Remaining refundable amount for the primary linked line (API compat). */
    protected function refundableRemainingForIssueReport(IssueReport $row): ?float
    {
        if (! $row->transaction_item_id) {
            return null;
        }

        return $this->refundableRemainingForLineItem((int) $row->transaction_item_id, $row->id, (int) $row->transaction_id);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function buildAffectedLinesPayload(IssueReport $row): array
    {
        $ids = $this->affectedIdsForReport($row);
        if (count($ids) === 0) {
            return [];
        }

        $items = TransactionItem::query()
            ->whereIn('id', $ids)
            ->where('transaction_id', $row->transaction_id)
            ->get()
            ->keyBy('id');

        $ordered = [];
        foreach ($ids as $id) {
            $item = $items->get($id);
            if (! $item) {
                continue;
            }
            $pieceCount = $item->piece_count;
            $lineTotal = (float) $item->total;
            $remaining = $this->refundableRemainingForLineItem((int) $item->id, $row->id, (int) $row->transaction_id);
            $suggestedPerPiece =
                ($pieceCount !== null && (int) $pieceCount > 0)
                    ? round($lineTotal / (int) $pieceCount, 2)
                    : null;

            $ordered[] = [
                'transaction_item_id' => (int) $item->id,
                'service_name' => $item->service_name,
                'line_total' => $lineTotal,
                'piece_count' => $pieceCount,
                'refundable_remaining' => $remaining,
                'suggested_refund_per_piece' => $suggestedPerPiece,
            ];
        }

        return $ordered;
    }

    protected function serializeIssueReport(IssueReport $row): array
    {
        $refundableRemaining = $this->refundableRemainingForIssueReport($row);
        $pieceCount = $row->transactionItem?->piece_count;
        $lineTotal = $row->transactionItem ? (float) $row->transactionItem->total : null;
        $suggestedPerPiece =
            ($pieceCount !== null && (int) $pieceCount > 0 && $lineTotal !== null)
                ? round($lineTotal / (int) $pieceCount, 2)
                : null;

        $affectedLines = $this->buildAffectedLinesPayload($row);
        $allocOut = null;
        if (is_array($row->refund_allocations) && count($row->refund_allocations) > 0) {
            $allocOut = array_map(function ($a) {
                return [
                    'transaction_item_id' => (int) ($a['transaction_item_id'] ?? 0),
                    'amount' => isset($a['amount']) ? round((float) $a['amount'], 2) : 0.0,
                ];
            }, $row->refund_allocations);
        }

        return [
            'id' => $row->id,
            'transaction_id' => $row->transaction_id,
            'transaction_item_id' => $row->transaction_item_id,
            'affected_transaction_item_ids' => $this->affectedIdsForReport($row),
            'affected_lines' => $affectedLines,
            'branch_id' => $row->branch_id,
            'branch_name' => $row->branch?->name,
            'reported_by_user_id' => $row->reported_by_user_id,
            'reported_by_name' => $this->displayName($row->reporter),
            'reported_by_role' => $row->reporter?->role,
            'assigned_employee_user_id' => $row->assigned_employee_user_id,
            'assigned_employee_name' => $this->displayName($row->assignedEmployee),
            'assigned_employee_role' => $row->assignedEmployee?->role,
            'issue_type' => $row->issue_type,
            'issue_note' => $row->issue_note,
            'status' => $row->status,
            'resolution_type' => $row->resolution_type,
            'resolution_note' => $row->resolution_note,
            'refund_amount' => $row->refund_amount !== null ? (float) $row->refund_amount : null,
            'refund_allocations' => $allocOut,
            'refundable_remaining' => $refundableRemaining,
            'suggested_refund_per_piece' => $suggestedPerPiece,
            'resolved_by_user_id' => $row->resolved_by_user_id,
            'resolved_by_name' => $this->displayName($row->resolver),
            'resolved_at' => $row->resolved_at,
            'transaction' => $row->transaction ? [
                'id' => $row->transaction->id,
                'receipt' => $row->transaction->receipt_number,
                'customer_name' => $row->transaction->customer_name,
                'payment_status' => $row->transaction->payment_status,
                'amount' => (float) $row->transaction->total_amount,
            ] : null,
            'transaction_item' => $row->transactionItem ? [
                'id' => $row->transactionItem->id,
                'service_name' => $row->transactionItem->service_name,
                'laundry_type' => $row->transactionItem->laundry_type,
                'rate' => (float) $row->transactionItem->rate,
                'kilos' => (float) $row->transactionItem->kilos,
                'line_total' => (float) $row->transactionItem->total,
                'piece_count' => $row->transactionItem->piece_count,
            ] : null,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    protected function serializeBackjob(Backjob $row): array
    {
        return [
            'id' => $row->id,
            'transaction_id' => $row->transaction_id,
            'issue_report_id' => $row->issue_report_id,
            'branch_id' => $row->branch_id,
            'branch_name' => $row->branch?->name,
            'created_by_user_id' => $row->created_by_user_id,
            'created_by_name' => $this->displayName($row->creator),
            'created_by_role' => $row->creator?->role,
            'assigned_employee_user_id' => $row->assigned_employee_user_id,
            'assigned_employee_name' => $this->displayName($row->assignedEmployee),
            'assigned_employee_role' => $row->assignedEmployee?->role,
            'reason_note' => $row->reason_note,
            'status' => $row->status,
            'is_free_redo' => (bool) $row->is_free_redo,
            'approved_by_user_id' => $row->approved_by_user_id,
            'approved_by_name' => $this->displayName($row->approver),
            'approved_at' => $row->approved_at,
            'completed_by_user_id' => $row->completed_by_user_id,
            'completed_by_name' => $this->displayName($row->completer),
            'completed_at' => $row->completed_at,
            'transaction' => $row->transaction ? [
                'id' => $row->transaction->id,
                'receipt' => $row->transaction->receipt_number,
                'customer_name' => $row->transaction->customer_name,
                'payment_status' => $row->transaction->payment_status,
                'amount' => (float) $row->transaction->total_amount,
            ] : null,
            'issue_report' => $row->issueReport ? [
                'id' => $row->issueReport->id,
                'issue_type' => $row->issueReport->issue_type,
                'status' => $row->issueReport->status,
            ] : null,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    protected function displayName(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        $first = trim((string) ($user->first_name ?? ''));
        $last = trim((string) ($user->last_name ?? ''));
        $full = trim($first.' '.$last);

        if ($full !== '') {
            return $full;
        }

        $fallback = trim((string) ($user->name ?? ''));

        return $fallback !== '' ? $fallback : null;
    }
}
