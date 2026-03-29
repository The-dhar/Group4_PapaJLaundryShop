<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'due_date',
        'archived',
        'is_rush',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(User::class, 'branch_id');
    }
}