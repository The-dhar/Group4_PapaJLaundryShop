<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServicePrice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ServicePriceController extends Controller
{
    public function index()
    {
        return response()->json(
            ServicePrice::orderBy('id')->get()
        );
    }

    /**
     * Multipart requests send `tiers` as a JSON string; normalize for validation.
     */
    protected function decodeTiersFromRequest(Request $request): void
    {
        $tiers = $request->input('tiers');
        if (is_string($tiers)) {
            $decoded = json_decode($tiers, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $request->merge(['tiers' => $decoded]);
            }
        }
    }

    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create service prices.'], 403);
        }

        $this->decodeTiersFromRequest($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'tiers' => 'required|array|min:1',
            'tiers.*.range' => 'required|string|max:255',
            'tiers.*.price' => 'required|numeric|min:0',
            'tiers.*.description' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
            'image' => 'nullable|file|image|max:5120',
        ]);

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('service-images', 'public');
        }

        unset($validated['image']);

        $servicePrice = ServicePrice::create($validated);

        return response()->json($servicePrice->fresh(), 201);
    }

    public function update(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can update service prices.'], 403);
        }

        $this->decodeTiersFromRequest($request);

        $servicePrice = ServicePrice::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category' => 'sometimes|required|string|max:255',
            'tiers' => 'sometimes|required|array|min:1',
            'tiers.*.range' => 'required_with:tiers|string|max:255',
            'tiers.*.price' => 'required_with:tiers|numeric|min:0',
            'tiers.*.description' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
            'image' => 'nullable|file|image|max:5120',
            'remove_image' => 'sometimes|boolean',
        ]);

        if ($request->boolean('remove_image')) {
            if ($servicePrice->image_path) {
                Storage::disk('public')->delete($servicePrice->image_path);
            }
            $validated['image_path'] = null;
        }

        if ($request->hasFile('image')) {
            if ($servicePrice->image_path) {
                Storage::disk('public')->delete($servicePrice->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('service-images', 'public');
        }

        unset($validated['image'], $validated['remove_image']);

        $servicePrice->update($validated);

        return response()->json($servicePrice->fresh());
    }

    public function destroy(Request $request, $id)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can delete service prices.'], 403);
        }

        $servicePrice = ServicePrice::findOrFail($id);

        if ($servicePrice->image_path) {
            Storage::disk('public')->delete($servicePrice->image_path);
        }

        $servicePrice->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
