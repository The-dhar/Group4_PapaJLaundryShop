<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    protected $fillable = [
        'receipt_number',
        'branch_id',
        'customer_name',
        'customer_address',
        'total_weight',
        'subtotal',
        'extras',
        'total_amount',
        'payment_status',
        'payment_method',
        'paid_amount',
        'inventory_status',
        'due_date'
    ];

    public function items()
    {
        return $this->hasMany(TransactionItem::class);
    }
}