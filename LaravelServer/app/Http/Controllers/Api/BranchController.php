<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class BranchController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isOwner()) {
            return User::where('role', 'manager')->get();
        }

        if ($user->isManager()) {
            return User::where('role', 'manager')->whereKey($user->id)->get();
        }

        abort(403);
    }

    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create branch accounts.'], 403);
        }

        $request->validate([
            'branchName' => 'required',
            'username' => 'required|unique:users,email',
            'password' => 'required|min:6'
        ]);

        $user = User::create([
            'name' => $request->branchName,
            'email' => $request->username,
            'role' => 'manager',
            'password' => Hash::make($request->password)
        ]);

        return response()->json($user);
    }

    public function updateClerk(Request $request, $id)
    {
        $user = $request->user();
        $branchId = (int) $id;

        if ($user->isManager() && $branchId !== (int) $user->id) {
            return response()->json(['message' => 'You can only update clerk settings for your own branch.'], 403);
        }

        if (! $user->isOwner() && ! $user->isManager()) {
            abort(403);
        }

        $request->validate([
            'clerk_username' => 'required'
        ]);

        $branch = User::findOrFail($id);

        $branch->clerk_username = $request->clerk_username;

        $branch->save();

        return response()->json($branch);
    }

    /**
     * Update branch login email, optional password, and clerk username (owner or same-branch manager).
     */
    public function update(Request $request, $id)
    {
        $authUser = $request->user();
        $branch = User::findOrFail($id);

        if (! $branch->isManager()) {
            return response()->json(['message' => 'Invalid branch account.'], 404);
        }

        if ($authUser->isManager() && (int) $branch->id !== (int) $authUser->id) {
            return response()->json(['message' => 'You can only update your own branch account.'], 403);
        }

        if (! $authUser->isOwner() && ! $authUser->isManager()) {
            abort(403);
        }

        $validated = $request->validate([
            'email' => 'required|email|max:255|unique:users,email,'.$branch->id,
            'password' => 'nullable|string|min:6',
            'clerk_username' => 'nullable|string|max:255',
        ]);

        $branch->email = $validated['email'];

        if (! empty($validated['password'])) {
            $branch->password = Hash::make($validated['password']);
        }

        if (array_key_exists('clerk_username', $validated)) {
            $branch->clerk_username = $validated['clerk_username'];
        }

        $branch->save();

        return response()->json($branch);
    }

    /**
     * Deactivate a branch manager account (owner only). Revokes API tokens for that user.
     */
    public function deactivate(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can deactivate branch accounts.'], 403);
        }

        $branch = User::findOrFail($id);

        if (! $branch->isManager()) {
            return response()->json(['message' => 'Invalid branch account.'], 404);
        }

        if ($branch->isOwner()) {
            return response()->json(['message' => 'Cannot deactivate the owner account.'], 403);
        }

        $branch->is_active = false;
        $branch->save();

        $branch->tokens()->delete();

        return response()->json([
            'message' => 'Branch account deactivated.',
            'user' => $branch->fresh(),
        ]);
    }
}

