<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use Illuminate\Http\Request;

class ServiceCategoryController extends Controller
{
    public function index()
    {
        return response()->json(
            ServiceCategory::query()->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create categories.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:service_categories,name',
        ]);

        $created = ServiceCategory::create($validated);

        return response()->json($created, 201);
    }

    public function update(Request $request, int $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can update categories.'], 403);
        }

        $category = ServiceCategory::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:service_categories,name,'.$category->id,
        ]);

        $category->update($validated);

        return response()->json($category->fresh());
    }

    public function destroy(Request $request, int $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can delete categories.'], 403);
        }

        $category = ServiceCategory::findOrFail($id);
        $name = $category->name;

        if (\App\Models\ServicePrice::query()->where('category', $name)->exists()) {
            return response()->json([
                'message' => 'Cannot delete this category because it is still used by existing services.',
            ], 422);
        }

        $category->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
