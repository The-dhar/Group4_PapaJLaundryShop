<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (! Schema::hasColumn('branches', 'vat_enabled')) {
                $table->boolean('vat_enabled')->default(true)->after('is_active');
            }
            if (! Schema::hasColumn('branches', 'vat_rate')) {
                $table->decimal('vat_rate', 5, 2)->default(12)->after('vat_enabled');
            }
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            if (Schema::hasColumn('branches', 'vat_rate')) {
                $table->dropColumn('vat_rate');
            }
            if (Schema::hasColumn('branches', 'vat_enabled')) {
                $table->dropColumn('vat_enabled');
            }
        });
    }
};
