<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'first_name')) {
                $table->string('first_name')->nullable()->after('name');
            }
            if (! Schema::hasColumn('customers', 'last_name')) {
                $table->string('last_name')->nullable()->after('first_name');
            }
            if (! Schema::hasColumn('customers', 'street')) {
                $table->string('street')->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'barangay')) {
                $table->string('barangay')->nullable()->after('street');
            }
            if (! Schema::hasColumn('customers', 'city')) {
                $table->string('city')->nullable()->after('barangay');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('customers')) {
            return;
        }

        Schema::table('customers', function (Blueprint $table) {
            if (Schema::hasColumn('customers', 'city')) {
                $table->dropColumn('city');
            }
            if (Schema::hasColumn('customers', 'barangay')) {
                $table->dropColumn('barangay');
            }
            if (Schema::hasColumn('customers', 'street')) {
                $table->dropColumn('street');
            }
            if (Schema::hasColumn('customers', 'last_name')) {
                $table->dropColumn('last_name');
            }
            if (Schema::hasColumn('customers', 'first_name')) {
                $table->dropColumn('first_name');
            }
        });
    }
};
