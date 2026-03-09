<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Customer;

class CustomerController extends Controller
{

    public function store(Request $request)
    {
        $customer = Customer::create([
            'name' => $request->name,
            'address' => $request->address
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