<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransactionItem extends Model
{
    protected $fillable = [
        'transaction_id',
        'service_name',
        'laundry_type',
        'rate',
        'kilos',
        'total',
        'piece_count',
    ];

    protected function casts(): array
    {
        return [
            'piece_count' => 'integer',
        ];
    }
}