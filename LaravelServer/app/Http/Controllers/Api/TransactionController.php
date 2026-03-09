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

        $request->validate([
            'customer_name' => 'required|string',
            'services' => 'required|array',
            'amount' => 'required|numeric'
        ]);

        // get logged in branch user
        $user = $request->user();

        DB::beginTransaction();

        try {

            // Save customer if provided
            if ($request->customer_name) {

                Customer::create([
                    'name' => $request->customer_name,
                    'address' => $request->customer_address
                ]);

            }

            // Generate receipt number
            $receipt = 'RCPT-' . (10000 + Transaction::count() + 1);

            // Create transaction
            $transaction = Transaction::create([

                'receipt_number' => $receipt,

                //(branch comes from logged user)
                'branch_id' => $user->id,

                'customer_name' => $request->customer_name,
                'customer_address' => $request->customer_address,

                'total_weight' => $request->weight ?? 0,
                'subtotal' => $request->subtotal ?? 0,
                'extras' => $request->extras ?? 0,
                'total_amount' => $request->amount,

                'payment_status' => $request->payment_status,
                'payment_method' => $request->payment_method,
                'paid_amount' => $request->paid_amount ?? 0,

                'inventory_status' => 'in_shop',

                'due_date' => $request->due_date,

                'is_rush' => $request->is_rush ?? false,

            ]);

            // Save services
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

            DB::commit();

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

        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'error' => 'Transaction failed',
                'message' => $e->getMessage()
            ], 500);

        }

    }

        public function index()
    {
        
        $transactions = Transaction::with('items')
            ->where('archived', false)
            ->get();

        return response()->json(
            $transactions->map(function ($txn) {

                return [
                    'id' => $txn->id,
                    'receipt' => $txn->receipt_number,
                    'customer_name' => $txn->customer_name,
                    'customer_address' => $txn->customer_address,

                    'amount' => $txn->total_amount,

                    'is_rush' => $txn->is_rush,
                    
                    'paid_amount' => $txn->paid_amount,

                    'payment_status' => $txn->payment_status,
                    'inventory_status' => $txn->inventory_status,

                    'due_date' => $txn->due_date,

                    'receipt_items' => $txn->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'serviceName' => $item->service_name,
                            'laundryType' => $item->laundry_type,
                            'rate' => $item->rate,
                            'kilos' => $item->kilos,
                            'total' => $item->total
                        ];
                    })
                ];
            })
        );
    }

    public function markPaid($id)
    {
        $transaction = Transaction::findOrFail($id);

        $transaction->payment_status = 'paid';

        $transaction->save();

        return response()->json([
            'message' => 'Transaction marked as paid'
        ]);
    }

    public function updatePayment(Request $request, $id)
    {
        $transaction = Transaction::findOrFail($id);

        $transaction->paid_amount = $request->paid_amount;
        $transaction->payment_method = $request->payment_method;

        $transaction->save();

        return response()->json([
            'message' => 'Payment updated'
        ]);
    }

    public function archive($id)
    {
        $transaction = Transaction::findOrFail($id);

        $transaction->archived = true;

        $transaction->save();

        return response()->json([
            'message' => 'Transaction archived successfully'
        ]);
    }

}