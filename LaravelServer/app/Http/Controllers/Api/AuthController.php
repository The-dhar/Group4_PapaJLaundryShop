<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|max:255',
        ]);

        $email = strtolower(trim($validated['email']));

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials',
            ], 401);
        }

        if (! $user->is_active) {
            return response()->json([
                'message' => 'This account has been deactivated.',
            ], 403);
        }

        if ($user->isBranchEmployee() && $user->branch_id === null) {
            return response()->json([
                'message' => 'Your account is not assigned to any branch. Ask the shop owner to assign you in Employee settings, then try again.',
            ], 403);
        }

        if ($user->role === 'manager') {
            return response()->json([
                'message' => 'Branch manager logins are no longer used. Sign in with an employee (clerk/staff) account.',
            ], 403);
        }

        if ($user->isBranchEmployee()) {
            $user->is_online = true;
            $user->save();
        }

        $user->load(['branch:id,name,clerk_username']);

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user->isBranchEmployee()) {
            $user->is_online = false;
            $user->save();
        }

        $user->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Update the authenticated user's display name and email (role unchanged).
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
        ]);

        $user->name = $validated['name'];
        $user->email = $validated['email'];
        $user->save();

        return response()->json($user);
    }

    /**
     * Change password for the authenticated user.
     */
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $user->password = $validated['password'];
        $user->save();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }
}
