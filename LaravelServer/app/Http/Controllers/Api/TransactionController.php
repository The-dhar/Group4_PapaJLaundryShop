<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Customer;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{

    public function store(Request $request)
    {

        // Save customer if provided
        if ($request->customer_name) {

            Customer::create([
                'name' => $request->customer_name,
                'address' => $request->customer_address
            ]);

        }

        // Create receipt number
        $receipt = 'RCPT-' . (10000 + Transaction::count() + 1);

        $transaction = Transaction::create([

            'receipt_number' => $receipt,
            'branch_id' => 1,

            'customer_name' => $request->customer_name,
            'customer_address' => $request->customer_address,

            'total_weight' => $request->weight,
            'subtotal' => $request->subtotal ?? 0,
            'extras' => $request->extras ?? 0,
            'total_amount' => $request->amount,

            'payment_status' => $request->payment_status,
            'payment_method' => $request->payment_method,
            'paid_amount' => $request->paid_amount,

            'inventory_status' => 'in_shop',

            'due_date' => $request->due_date

        ]);

        foreach ($request->services as $service) {

            TransactionItem::create([

                'transaction_id' => $transaction->id,
                'service_name' => $service['serviceName'],
                'laundry_type' => $service['laundryType'],
                'rate' => $service['rate'],
                'kilos' => $service['kilos'],
                'total' => $service['total']

            ]);

        }

        return response()->json([
            'receipt' => $receipt,
            'customer_name' => $transaction->customer_name,
            'customer_address' => $transaction->customer_address,
            'services' => $request->services,
            'amount' => $transaction->total_amount,
            'paid_amount' => $transaction->paid_amount,
            'payment_method' => $transaction->payment_method,
            'inventory_status' => $transaction->inventory_status,
            'due_date' => $transaction->due_date
        ]);

    }

}