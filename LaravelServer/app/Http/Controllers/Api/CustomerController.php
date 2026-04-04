<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        if (! $user->isOwner() && ! $user->isManager()) {
            abort(403);
        }

        $rules = [
            'name' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'first_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'street' => 'nullable|string|max:255',
            'barangay' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
        ];

        if ($user->isOwner()) {
            $rules['branch_id'] = 'required|integer|exists:users,id';
        }

        $validated = $request->validate($rules);

        $branchId = null;
        if ($user->isManager()) {
            $branchId = (int) $user->id;
        } else {
            $branch = User::findOrFail($validated['branch_id']);
            if (! $branch->isManager()) {
                throw ValidationException::withMessages([
                    'branch_id' => ['The selected account must be a branch (manager) user.'],
                ]);
            }
            $branchId = (int) $branch->id;
        }

        $firstName = trim((string) ($validated['first_name'] ?? ''));
        $lastName = trim((string) ($validated['last_name'] ?? ''));
        $street = trim((string) ($validated['street'] ?? ''));
        $barangay = trim((string) ($validated['barangay'] ?? ''));
        $city = trim((string) ($validated['city'] ?? ''));

        $computedName = trim($firstName . ' ' . $lastName);
        $computedAddress = implode(', ', array_values(array_filter([$street, $barangay, $city])));

        $customer = Customer::create([
            'branch_id' => $branchId,
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

    public function search(Request $request, string $name)
    {
        $user = $request->user();

        if (! $user->isOwner() && ! $user->isManager()) {
            abort(403);
        }

        $query = Customer::query()->where('name', 'LIKE', '%' . $name . '%');

        if ($user->isManager()) {
            $query->where('branch_id', $user->id);
        } elseif ($request->filled('branch_id')) {
            $request->validate([
                'branch_id' => 'integer|exists:users,id',
            ]);
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        $customers = $query->limit(10)->get();

        return response()->json($customers);
    }
}
