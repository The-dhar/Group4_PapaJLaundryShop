<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ServicePrice;
use Illuminate\Http\Request;

class ServicePriceController extends Controller
{
    public function index()
    {
        return response()->json(
            ServicePrice::orderBy('id')->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'tiers' => 'required|array|min:1',
            'tiers.*.range' => 'required|string|max:255',
            'tiers.*.price' => 'required|numeric|min:0',
            'tiers.*.description' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
        ]);

        $servicePrice = ServicePrice::create($validated);

        return response()->json($servicePrice, 201);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'category' => 'sometimes|required|string|max:255',
            'tiers' => 'sometimes|required|array|min:1',
            'tiers.*.range' => 'required_with:tiers|string|max:255',
            'tiers.*.price' => 'required_with:tiers|numeric|min:0',
            'tiers.*.description' => 'nullable|string|max:255',
            'effective_date' => 'nullable|date',
        ]);

        $servicePrice = ServicePrice::findOrFail($id);
        $servicePrice->update($validated);

        return response()->json($servicePrice);
    }
}
