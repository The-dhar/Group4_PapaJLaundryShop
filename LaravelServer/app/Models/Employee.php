<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'name',
        'username',
        'role',
        'status',
        'revenue_outcome',
        'gain_percent',
        'loss_percent',
        'net_revenue_php',
        'clerk_since',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'gain_percent' => 'integer',
            'loss_percent' => 'integer',
            'net_revenue_php' => 'decimal:2',
            'clerk_since' => 'date',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(User::class, 'branch_id');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(EmployeeBranchHistory::class);
    }
}

