<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = [
        'name',
        'first_name',
        'middle_initial',
        'last_name',
        'email',
        'password',
        'role',
        'branch_id',
        'clerk_username',
        'is_active',
        'is_online',
    ];

    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_online' => 'boolean',
        ];
    }

    /** Full access (mobile app + owner-only APIs). Single account uses role `owner` (e.g. owner@gmail.com). */
    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isManager(): bool
    {
        return $this->role === 'manager';
    }

    public function isClerk(): bool
    {
        return $this->role === 'clerk';
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    public function isBranchEmployee(): bool
    {
        return $this->isClerk() || $this->isStaff();
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /** Transactions created while this user was logged in (POS). */
    public function createdTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'created_by_user_id');
    }
}
