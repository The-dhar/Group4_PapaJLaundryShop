<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name',
        'address',
        'first_name',
        'last_name',
        'street',
        'barangay',
        'city',
    ];
}