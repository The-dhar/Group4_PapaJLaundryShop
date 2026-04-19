<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BranchController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->isOwner()) {
            return Branch::query()->orderBy('name')->get();
        }

        if ($user->isBranchEmployee()) {
            if (! $user->branch_id) {
                return response()->json([]);
            }
            $branch = Branch::query()->where('id', $user->branch_id)->first();

            return response()->json($branch ? [$branch] : []);
        }

        abort(403);
    }

    /**
     * Create a branch record only (no login credentials).
     */
    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create branches.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $branch = Branch::create([
            'name' => $validated['name'],
            'is_active' => true,
        ]);

        return response()->json($branch, 201);
    }

    public function updateClerk(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can update clerk display name.'], 403);
        }

        $request->validate([
            'clerk_username' => 'required|string|max:255',
        ]);

        $branch = Branch::findOrFail($id);
        $branch->clerk_username = $request->clerk_username;
        $branch->save();

        return response()->json($branch);
    }

    /**
     * Update branch display name and optional clerk username (owner only).
     */
    public function update(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can update branches.'], 403);
        }

        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'clerk_username' => 'nullable|string|max:255',
        ]);

        $branch->name = $validated['name'];
        if (array_key_exists('clerk_username', $validated)) {
            $branch->clerk_username = $validated['clerk_username'];
        }
        $branch->save();

        return response()->json($branch);
    }

    /**
     * Deactivate branch (soft — no transactions deleted). Owner only.
     */
    public function deactivate(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can deactivate branches.'], 403);
        }

        $branch = Branch::findOrFail($id);
        $branch->is_active = false;
        $branch->save();

        return response()->json([
            'message' => 'Branch deactivated.',
            'branch' => $branch->fresh(),
        ]);
    }

    public function activate(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can activate branches.'], 403);
        }

        $branch = Branch::findOrFail($id);
        $branch->is_active = true;
        $branch->save();

        return response()->json([
            'message' => 'Branch activated.',
            'branch' => $branch->fresh(),
        ]);
    }

    /**
     * VAT toggle and rate for a branch. Owner: any branch. Clerk: own branch only. Staff: not allowed.
     */
    public function updateVatSettings(Request $request, $id)
    {
        $user = $request->user();
        $branchId = (int) $id;

        if ($user->isStaff()) {
            return response()->json(['message' => 'Only a clerk or the owner can update VAT settings.'], 403);
        }

        if ($user->isClerk()) {
            if (! $user->branch_id || (int) $user->branch_id !== $branchId) {
                return response()->json(['message' => 'You can only update VAT for your assigned branch.'], 403);
            }
        } elseif (! $user->isOwner()) {
            return response()->json(['message' => 'This account cannot update VAT settings.'], 403);
        }

        $validated = $request->validate([
            'vat_enabled' => 'required|boolean',
            'vat_rate' => [
                Rule::requiredIf(fn () => $request->boolean('vat_enabled')),
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],
        ]);

        $branch = Branch::findOrFail($branchId);
        $branch->vat_enabled = (bool) $validated['vat_enabled'];

        $incoming = $validated['vat_rate'] ?? null;
        if ($incoming !== null && $incoming !== '') {
            $branch->vat_rate = round((float) $incoming, 2);
        } elseif ($branch->vat_enabled) {
            $branch->vat_rate = round((float) ($branch->vat_rate ?? 12), 2);
        }

        $branch->save();

        return response()->json($branch->fresh());
    }
}
