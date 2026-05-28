<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Backjob extends Model
{
    protected $fillable = [
        'transaction_id',
        'issue_report_id',
        'branch_id',
        'created_by_user_id',
        'assigned_employee_user_id',
        'reason_note',
        'status',
        'approved_by_user_id',
        'approved_at',
        'completed_by_user_id',
        'completed_at',
        'is_free_redo',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'completed_at' => 'datetime',
            'is_free_redo' => 'boolean',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function issueReport(): BelongsTo
    {
        return $this->belongsTo(IssueReport::class, 'issue_report_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function assignedEmployee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_employee_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    public function completer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by_user_id');
    }
}
