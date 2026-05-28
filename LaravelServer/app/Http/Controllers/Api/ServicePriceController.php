<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServiceCategory;
use App\Models\ServicePrice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ServicePriceController extends Controller
{
    protected function categoryValidationRule(): array
    {
        return [
            'required',
            'string',
            'max:255',
            function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_string($value)) {
                    $fail('The '.$attribute.' field is invalid.');
                    return;
                }
                if (strtolower($value) === 'misc') {
                    return;
                }
                $exists = ServiceCategory::query()->whereRaw('LOWER(name) = ?', [strtolower($value)])->exists();
                if (! $exists) {
                    $fail('The selected '.$attribute.' is invalid.');
                }
            },
        ];
    }

    /**
     * Public image endpoint (no storage symlink required).
     */
    public function showImage(string $path)
    {
        $normalized = ltrim(str_replace('\\', '/', $path), '/');
        if ($normalized === '' || str_contains($normalized, '..')) {
            abort(404);
        }

        // Only expose service image uploads.
        if (! str_starts_with($normalized, 'service-images/')) {
            abort(404);
        }

        if (! Storage::disk('public')->exists($normalized)) {
            abort(404);
        }

        return response()->file(Storage::disk('public')->path($normalized), [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

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

    /**
     * Additional charges (category Misc) can be sent as flat `price` + `description`; store as a single tier row.
     */
    protected function mergeMiscFlatPriceToTiers(Request $request, ?ServicePrice $existing = null): void
    {
        $cat = strtolower((string) $request->input('category', $existing?->category ?? ''));
        if ($cat !== 'misc') {
            return;
        }

        $tiers = $request->input('tiers');
        $hasTiers = is_array($tiers) && count($tiers) > 0;
        if ($hasTiers) {
            return;
        }

        if ($request->has('price')) {
            $request->merge([
                'tiers' => [[
                    'range' => '—',
                    'price' => $request->input('price'),
                    'description' => (string) $request->input('description', ''),
                ]],
            ]);
        }
    }

    public function store(Request $request)
    {
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can create service prices.'], 403);
        }

        $this->decodeTiersFromRequest($request);
        $this->mergeMiscFlatPriceToTiers($request, null);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => $this->categoryValidationRule(),
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
        $this->mergeMiscFlatPriceToTiers($request, $servicePrice);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category' => ['sometimes', ...$this->categoryValidationRule()],
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
