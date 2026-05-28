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
        'created_by_user_id',
        'customer_name',
        'customer_middle_name',
        'customer_address',
        'total_weight',
        'subtotal',
        'extras',
        'vat_rate',
        'vat_amount',
        'total_amount',
        'payment_status',
        'payment_method',
        'paid_amount',
        'penalty_amount',
        'penalty_suggested_amount',
        'penalty_override_reason',
        'inventory_status',
        'due_date',
        'archived',
        'is_rush',
    ];

    protected function casts(): array
    {
        return [
            'total_weight' => 'float',
            'subtotal' => 'float',
            'extras' => 'float',
            'vat_rate' => 'float',
            'vat_amount' => 'float',
            'total_amount' => 'float',
            'paid_amount' => 'float',
            'penalty_amount' => 'float',
            'penalty_suggested_amount' => 'float',
            'archived' => 'boolean',
            'is_rush' => 'boolean',
            'due_date' => 'date:Y-m-d',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
