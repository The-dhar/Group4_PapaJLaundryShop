<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Customer;

class CustomerController extends Controller
{

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'first_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'street' => 'nullable|string|max:255',
            'barangay' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
        ]);

        $firstName = trim((string) ($validated['first_name'] ?? ''));
        $lastName = trim((string) ($validated['last_name'] ?? ''));
        $street = trim((string) ($validated['street'] ?? ''));
        $barangay = trim((string) ($validated['barangay'] ?? ''));
        $city = trim((string) ($validated['city'] ?? ''));

        $computedName = trim($firstName . ' ' . $lastName);
        $computedAddress = implode(', ', array_values(array_filter([$street, $barangay, $city])));

        $customer = Customer::create([
            'name' => $validated['name'] ?? $computedName,
            'address' => $validated['address'] ?? $computedAddress,
            'first_name' => $firstName !== '' ? $firstName : null,
            'last_name' => $lastName !== '' ? $lastName : null,
            'street' => $street !== '' ? $street : null,
            'barangay' => $barangay !== '' ? $barangay : null,
            'city' => $city !== '' ? $city : null,
        ]);

        return response()->json($customer);
    }

    public function search($name)
    {

        $customers = Customer::where('name', 'LIKE', "%$name%")
            ->limit(10)
            ->get();

        return response()->json($customers);

    }

}