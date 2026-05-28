<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('employees')) {
            Schema::create('employees', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('username')->unique();
                $table->string('role')->default('Clerk');
                $table->string('status')->default('Active');
                $table->string('revenue_outcome')->nullable();
                $table->unsignedSmallInteger('gain_percent')->default(0);
                $table->unsignedSmallInteger('loss_percent')->default(0);
                $table->decimal('net_revenue_php', 12, 2)->default(0);
                $table->date('clerk_since')->nullable();
                $table->foreignId('branch_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('employee_branch_histories')) {
            Schema::create('employee_branch_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
                $table->foreignId('branch_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('role')->nullable();
                $table->string('period_label')->nullable();
                $table->string('revenue_outcome')->nullable();
                $table->timestamp('assigned_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_branch_histories');
        Schema::dropIfExists('employees');
    }
};

