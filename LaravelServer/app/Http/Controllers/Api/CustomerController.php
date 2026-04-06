<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        if (! $user->isOwner() && ! $user->isBranchEmployee()) {
            abort(403);
        }

        $rules = [
            'name' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'first_name' => 'nullable|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'street' => 'nullable|string|max:255',
            'barangay' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
        ];

        if ($user->isOwner()) {
            $rules['branch_id'] = 'required|integer|exists:branches,id';
        }

        $validated = $request->validate($rules);

        $branchId = null;
        if ($user->isOwner()) {
            $branchId = (int) $validated['branch_id'];
        } else {
            if (! $user->branch_id) {
                throw ValidationException::withMessages([
                    'branch_id' => ['No branch is assigned to your account.'],
                ]);
            }
            $branchId = (int) $user->branch_id;
        }

        $firstName = trim((string) ($validated['first_name'] ?? ''));
        $middleName = trim((string) ($validated['middle_name'] ?? ''));
        $lastName = trim((string) ($validated['last_name'] ?? ''));
        $street = trim((string) ($validated['street'] ?? ''));
        $barangay = trim((string) ($validated['barangay'] ?? ''));
        $city = trim((string) ($validated['city'] ?? ''));

        $computedName = trim(implode(' ', array_filter([$firstName, $middleName !== '' ? $middleName : null, $lastName])));
        $computedAddress = implode(', ', array_values(array_filter([$street, $barangay, $city])));

        $customer = Customer::create([
            'branch_id' => $branchId,
            'name' => $validated['name'] ?? $computedName,
            'address' => $validated['address'] ?? $computedAddress,
            'first_name' => $firstName !== '' ? $firstName : null,
            'middle_name' => $middleName !== '' ? $middleName : null,
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

        if (! $user->isOwner() && ! $user->isBranchEmployee()) {
            abort(403);
        }

        $query = Customer::query()->where('name', 'LIKE', '%'.$name.'%');

        if ($user->isBranchEmployee()) {
            if (! $user->branch_id) {
                return response()->json([]);
            }
            $query->where('branch_id', $user->branch_id);
        } elseif ($request->filled('branch_id')) {
            $request->validate([
                'branch_id' => 'integer|exists:branches,id',
            ]);
            $query->where('branch_id', (int) $request->query('branch_id'));
        }

        $customers = $query->limit(10)->get();

        return response()->json($customers);
    }
}
