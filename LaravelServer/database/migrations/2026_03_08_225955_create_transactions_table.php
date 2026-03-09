<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {

            $table->id();

            $table->string('receipt_number');

            $table->foreignId('branch_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('customer_name');
            $table->string('customer_address')->nullable();

            $table->decimal('total_weight', 8, 2)->default(0);
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->decimal('extras', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2)->default(0);

            $table->enum('payment_status', ['paid','unpaid'])->default('unpaid');
            $table->string('payment_method')->nullable();

            $table->decimal('paid_amount', 10, 2)->default(0);

            $table->enum('inventory_status', ['in_shop','picked_up'])->default('in_shop');

            $table->date('due_date')->nullable();

            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};