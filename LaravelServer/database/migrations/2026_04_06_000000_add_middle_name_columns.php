<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customers') && ! Schema::hasColumn('customers', 'middle_name')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('middle_name')->nullable()->after('last_name');
            });
        }

        if (Schema::hasTable('transactions') && ! Schema::hasColumn('transactions', 'customer_middle_name')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->string('customer_middle_name')->nullable()->after('customer_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('transactions') && Schema::hasColumn('transactions', 'customer_middle_name')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->dropColumn('customer_middle_name');
            });
        }

        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'middle_name')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropColumn('middle_name');
            });
        }
    }
};
