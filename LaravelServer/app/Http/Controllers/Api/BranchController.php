<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class BranchController extends Controller
{
    public function index()
    {
        return User::where('role', 'manager')->get();
    }

    public function store(Request $request)
    {
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

        $request->validate([
            'clerk_username' => 'required'
        ]);

        $branch = User::findOrFail($id);

        $branch->clerk_username = $request->clerk_username;

        $branch->save();

        return response()->json($branch);
    }
}

