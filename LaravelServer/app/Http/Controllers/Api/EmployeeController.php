<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeBranchHistory;
use App\Models\User;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function index()
    {
        $employees = Employee::with([
            'branch:id,name,email,clerk_username',
            'histories' => function ($query) {
                $query->with('branch:id,name,email')
                    ->orderByDesc('id');
            },
        ])->orderByDesc('id')->get();

        return response()->json($employees->map(function (Employee $employee) {
            return [
                'id' => $employee->id,
                'name' => $employee->name,
                'username' => $employee->username,
                'role' => $employee->role,
                'status' => $employee->status,
                'revenue_outcome' => $employee->revenue_outcome,
                'gain_percent' => (int) $employee->gain_percent,
                'loss_percent' => (int) $employee->loss_percent,
                'net_revenue_php' => (float) $employee->net_revenue_php,
                'clerk_since' => optional($employee->clerk_since)?->toDateString(),
                'branch_id' => $employee->branch_id,
                'branch_name' => optional($employee->branch)->name,
                'branch_email' => optional($employee->branch)->email,
                'created_at' => $employee->created_at,
                'updated_at' => $employee->updated_at,
                'history' => $employee->histories->map(function (EmployeeBranchHistory $history) {
                    return [
                        'id' => $history->id,
                        'branch_id' => $history->branch_id,
                        'branch_name' => optional($history->branch)->name,
                        'role' => $history->role,
                        'period_label' => $history->period_label,
                        'revenue_outcome' => $history->revenue_outcome,
                        'assigned_at' => $history->assigned_at,
                        'ended_at' => $history->ended_at,
                    ];
                }),
            ];
        }));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:employees,username',
            'role' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:255',
            'revenue_outcome' => 'nullable|string|max:255',
            'gain_percent' => 'nullable|integer|min:0|max:100',
            'loss_percent' => 'nullable|integer|min:0|max:100',
            'net_revenue_php' => 'nullable|numeric',
            'clerk_since' => 'nullable|date',
            'branch_id' => 'nullable|exists:users,id',
        ]);

        $employee = Employee::create([
            'name' => $validated['name'],
            'username' => strtolower(trim($validated['username'])),
            'role' => $validated['role'] ?? 'Clerk',
            'status' => $validated['status'] ?? 'Active',
            'revenue_outcome' => $validated['revenue_outcome'] ?? null,
            'gain_percent' => $validated['gain_percent'] ?? 0,
            'loss_percent' => $validated['loss_percent'] ?? 0,
            'net_revenue_php' => $validated['net_revenue_php'] ?? 0,
            'clerk_since' => $validated['clerk_since'] ?? null,
            'branch_id' => $validated['branch_id'] ?? null,
        ]);

        if (! empty($employee->branch_id)) {
            $this->syncBranchClerkUsername((int) $employee->branch_id, $employee->username);

            EmployeeBranchHistory::create([
                'employee_id' => $employee->id,
                'branch_id' => $employee->branch_id,
                'role' => $employee->role,
                'period_label' => 'Current assignment',
                'revenue_outcome' => $employee->revenue_outcome,
                'assigned_at' => now(),
            ]);
        }

        return response()->json($employee->fresh(), 201);
    }

    public function update(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'username' => 'sometimes|required|string|max:255|unique:employees,username,' . $employee->id,
            'role' => 'sometimes|nullable|string|max:255',
            'status' => 'sometimes|nullable|string|max:255',
            'revenue_outcome' => 'sometimes|nullable|string|max:255',
            'gain_percent' => 'sometimes|nullable|integer|min:0|max:100',
            'loss_percent' => 'sometimes|nullable|integer|min:0|max:100',
            'net_revenue_php' => 'sometimes|nullable|numeric',
            'clerk_since' => 'sometimes|nullable|date',
        ]);

        if (array_key_exists('username', $validated)) {
            $validated['username'] = strtolower(trim($validated['username']));
        }

        $employee->update($validated);

        return response()->json($employee->fresh());
    }

    public function assignBranch(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'branch_id' => 'nullable|exists:users,id',
            'revenue_outcome' => 'nullable|string|max:255',
            'period_label' => 'nullable|string|max:255',
        ]);

        $newBranchId = $validated['branch_id'] ?? null;
        $oldBranchId = $employee->branch_id;

        if ($oldBranchId && $oldBranchId !== $newBranchId) {
            EmployeeBranchHistory::create([
                'employee_id' => $employee->id,
                'branch_id' => $oldBranchId,
                'role' => $employee->role,
                'period_label' => $validated['period_label'] ?? 'Previous assignment',
                'revenue_outcome' => $validated['revenue_outcome'] ?? $employee->revenue_outcome,
                'assigned_at' => $employee->updated_at,
                'ended_at' => now(),
            ]);
        }

        $employee->branch_id = $newBranchId;
        if ($newBranchId && ! $employee->clerk_since) {
            $employee->clerk_since = now()->toDateString();
        }
        $employee->save();

        if ($newBranchId) {
            $this->syncBranchClerkUsername((int) $newBranchId, $employee->username);
        }

        if ($oldBranchId && $oldBranchId !== $newBranchId) {
            $oldBranch = User::find($oldBranchId);
            if ($oldBranch && $oldBranch->clerk_username === $employee->username) {
                $oldBranch->clerk_username = null;
                $oldBranch->save();
            }
        }

        return response()->json($employee->fresh());
    }

    private function syncBranchClerkUsername(int $branchId, string $clerkUsername): void
    {
        $branch = User::find($branchId);

        if (! $branch) {
            return;
        }

        $branch->clerk_username = $clerkUsername;
        $branch->save();
    }
}

