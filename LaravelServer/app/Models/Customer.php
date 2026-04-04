<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Customer extends Model
{
    protected $fillable = [
        'branch_id',
        'name',
        'address',
        'first_name',
        'last_name',
        'street',
        'barangay',
        'city',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(User::class, 'branch_id');
    }
}