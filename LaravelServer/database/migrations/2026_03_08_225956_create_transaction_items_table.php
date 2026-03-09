<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {

            $table->id();

            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->cascadeOnDelete();

            $table->string('service_name');

            $table->string('laundry_type');

            $table->decimal('rate', 10, 2);

            $table->decimal('kilos', 8, 2);

            $table->decimal('total', 10, 2);

            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};