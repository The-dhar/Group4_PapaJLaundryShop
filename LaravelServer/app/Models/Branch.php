<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    protected $fillable = [
        'name',
        'legacy_manager_user_id',
        'clerk_username',
        'is_active',
        'vat_enabled',
        'vat_rate',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'vat_enabled' => 'boolean',
            'vat_rate' => 'decimal:2',
        ];
    }

    public function legacyManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'legacy_manager_user_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'branch_id');
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class, 'branch_id');
    }
}
