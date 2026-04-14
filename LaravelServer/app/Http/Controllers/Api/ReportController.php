<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Backjob;
use App\Models\IssueReport;
use App\Models\ReportActivityLog;
use App\Models\Transaction;
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
            'branch_id' => $transaction->branch_id,
            'reported_by_user_id' => $user->id,
            'assigned_employee_user_id' => $assignedEmployee->id,
            'issue_type' => strtolower(trim((string) $validated['issue_type'])),
            'issue_note' => trim((string) ($validated['issue_note'] ?? '')) ?: null,
            'status' => 'pending',
        ]);

        $this->logActivity('issue_report', $report->id, 'created', null, 'pending', $user->id, null, [
            'transaction_id' => $transaction->id,
            'issue_type' => $report->issue_type,
        ]);

        $report->load([
            'transaction:id,receipt_number,payment_status,customer_name,total_amount,branch_id',
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
            'resolution_note' => 'nullable|string|max:2000',
        ]);

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, self::ISSUE_RESOLVABLE_STATUSES, true)) {
            return response()->json(['message' => 'Only pending or under_review reports can be resolved.'], 422);
        }

        $oldStatus = $report->status;
        $report->status = 'resolved';
        $report->resolution_type = strtolower(trim((string) $validated['resolution_type']));
        $report->resolution_note = trim((string) ($validated['resolution_note'] ?? '')) ?: null;
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
            'resolution_note' => 'nullable|string|max:2000',
        ]);

        $report = $this->issueReportForUser($user, $id, true);

        if (! in_array($report->status, self::ISSUE_RESOLVABLE_STATUSES, true)) {
            return response()->json(['message' => 'Only pending or under_review reports can be rejected.'], 422);
        }

        $oldStatus = $report->status;
        $report->status = 'rejected';
        $report->resolution_type = null;
        $report->resolution_note = trim((string) ($validated['resolution_note'] ?? '')) ?: null;
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

    protected function serializeIssueReport(IssueReport $row): array
    {
        return [
            'id' => $row->id,
            'transaction_id' => $row->transaction_id,
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
