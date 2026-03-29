<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServicePrice extends Model
{
    protected $fillable = [
        'name',
        'category',
        'tiers',
        'effective_date',
    ];

    protected $casts = [
        'tiers' => 'array',
        'effective_date' => 'date',
    ];
}
