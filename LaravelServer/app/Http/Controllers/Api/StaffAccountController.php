<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StaffAccountController extends Controller
{
    /**
     * List employee logins (clerk/staff) for owner (e.g. Employee settings screen).
     */
    public function index(Request $request)
    {
        if (! $request->user()->isOwner()) {
            abort(403);
        }

        return $this->staffAccountsWithRevenue()->get();
    }

    /**
     * Owner creates a clerk or staff login (single branch per account; branch optional).
     */
    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create employee accounts.'], 403);
        }

        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'middle_initial' => 'nullable|string|max:8',
            'last_name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6|confirmed',
            'role' => ['required', Rule::in(['clerk', 'staff'])],
            'branch_id' => 'nullable|integer|exists:branches,id',
        ]);

        if (! empty($validated['branch_id'])) {
            $this->assertSlotAvailable(
                (int) $validated['branch_id'],
                $validated['role'],
                null
            );
        }

        $validated['email'] = strtolower(trim($validated['email']));

        $displayName = trim($validated['first_name'].' '.$validated['last_name']);

        try {
            $user = User::create([
                'name' => $displayName,
                'first_name' => $validated['first_name'],
                'middle_initial' => $validated['middle_initial'] ?? null,
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => $validated['role'],
                'branch_id' => $validated['branch_id'] ?? null,
                'is_active' => true,
            ]);
        } catch (QueryException $e) {
            Log::warning('staff_accounts.store.query', ['message' => $e->getMessage()]);
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') !== false || stripos($msg, 'UNIQUE constraint') !== false) {
                return response()->json([
                    'message' => 'The given data was invalid.',
                    'errors' => ['email' => ['This email is already registered.']],
                ], 422);
            }

            return response()->json([
                'message' => config('app.debug') ? $msg : 'Database error while saving. Run migrations on the server and try again.',
            ], 500);
        }

        return response()->json($user, 201);
    }

    /**
     * Owner updates staff profile, login email, optional password, role, branch.
     */
    public function update(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can update employee accounts.'], 403);
        }

        $user = User::findOrFail($id);

        if (! $user->isClerk() && ! $user->isStaff()) {
            return response()->json(['message' => 'Not an employee account.'], 404);
        }

        $validated = $request->validate([
            'first_name' => 'sometimes|required|string|max:255',
            'middle_initial' => 'nullable|string|max:8',
            'last_name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|max:255|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:6|confirmed',
            'role' => ['sometimes', 'required', Rule::in(['clerk', 'staff'])],
            'branch_id' => 'nullable|integer|exists:branches,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $newRole = $validated['role'] ?? $user->role;
        $newBranchId = array_key_exists('branch_id', $validated)
            ? $validated['branch_id']
            : $user->branch_id;

        if ($newBranchId !== null) {
            $this->assertSlotAvailable((int) $newBranchId, $newRole, (int) $user->id);
        }

        if (isset($validated['first_name']) || isset($validated['last_name'])) {
            $fn = $validated['first_name'] ?? $user->first_name;
            $ln = $validated['last_name'] ?? $user->last_name;
            $user->name = trim($fn.' '.$ln);
        }

        foreach (['first_name', 'middle_initial', 'last_name', 'email', 'role', 'branch_id', 'is_active'] as $field) {
            if (array_key_exists($field, $validated)) {
                $user->{$field} = $validated[$field];
            }
        }

        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }

        $user->save();

        if (array_key_exists('is_active', $validated) && $validated['is_active'] === false) {
            $user->is_online = false;
            $user->save();
            $user->tokens()->delete();
        }

        return response()->json($this->staffUserWithRevenue($user));
    }

    /**
     * Clerk/staff rows with branch + sum of paid POS sales they created (`total_revenue_php`).
     */
    protected function staffAccountsWithRevenue()
    {
        return User::query()
            ->whereIn('role', ['clerk', 'staff'])
            ->with(['branch:id,name,clerk_username,is_active'])
            ->withSum([
                'createdTransactions as total_revenue_php' => function ($q) {
                    $q->where('payment_status', 'paid')->where('archived', false);
                },
            ], 'total_amount')
            ->orderBy('name');
    }

    protected function staffUserWithRevenue(User $user): User
    {
        return $this->staffAccountsWithRevenue()
            ->whereKey($user->id)
            ->firstOrFail();
    }

    /**
     * At most one clerk and one staff per branch.
     */
    protected function assertSlotAvailable(int $branchId, string $role, ?int $exceptUserId): void
    {
        $q = User::query()
            ->where('branch_id', $branchId)
            ->where('role', $role);

        if ($exceptUserId !== null) {
            $q->where('id', '!=', $exceptUserId);
        }

        if ($q->exists()) {
            throw ValidationException::withMessages([
                'branch_id' => ["This branch already has a {$role} assigned."],
            ]);
        }
    }
}
