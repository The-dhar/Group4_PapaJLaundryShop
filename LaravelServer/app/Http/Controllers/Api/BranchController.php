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
}

