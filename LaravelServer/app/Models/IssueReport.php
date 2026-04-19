<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IssueReport extends Model
{
    protected $fillable = [
        'transaction_id',
        'transaction_item_id',
        'branch_id',
        'reported_by_user_id',
        'assigned_employee_user_id',
        'issue_type',
        'issue_note',
        'status',
        'resolution_type',
        'resolution_note',
        'refund_amount',
        'resolved_by_user_id',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'refund_amount' => 'decimal:2',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function transactionItem(): BelongsTo
    {
        return $this->belongsTo(TransactionItem::class, 'transaction_item_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_user_id');
    }

    public function assignedEmployee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_employee_user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }

    public function backjobs(): HasMany
    {
        return $this->hasMany(Backjob::class, 'issue_report_id');
    }
}
