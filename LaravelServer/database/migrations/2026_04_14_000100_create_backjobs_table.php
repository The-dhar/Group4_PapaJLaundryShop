<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('backjobs')) {
            return;
        }

        Schema::create('backjobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->foreignId('issue_report_id')->nullable()->constrained('issue_reports')->nullOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_employee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason_note')->nullable();
            $table->string('status', 32)->default('pending');
            $table->foreignId('approved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('completed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->boolean('is_free_redo')->default(true);
            $table->timestamps();

            $table->index('branch_id');
            $table->index('transaction_id');
            $table->index('issue_report_id');
            $table->index('status');
            $table->index('assigned_employee_user_id');
            $table->index('created_at');
            $table->index(['transaction_id', 'status']);
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS backjobs_one_open_per_transaction ON backjobs (transaction_id) WHERE status IN ('pending','approved','in_progress')");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('backjobs')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS backjobs_one_open_per_transaction');
        }

        Schema::dropIfExists('backjobs');
    }
};
