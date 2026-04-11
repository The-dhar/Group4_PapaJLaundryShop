<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('issue_reports')) {
            return;
        }

        Schema::create('issue_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('reported_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_employee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('issue_type', 32);
            $table->text('issue_note')->nullable();
            $table->string('status', 32)->default('pending');
            $table->string('resolution_type', 32)->nullable();
            $table->text('resolution_note')->nullable();
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index('branch_id');
            $table->index('transaction_id');
            $table->index('status');
            $table->index('reported_by_user_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issue_reports')) {
            return;
        }

        Schema::dropIfExists('issue_reports');
    }
};
