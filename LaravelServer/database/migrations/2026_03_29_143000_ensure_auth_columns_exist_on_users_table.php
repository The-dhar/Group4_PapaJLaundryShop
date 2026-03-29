<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable();
            }

            if (! Schema::hasColumn('users', 'remember_token')) {
                $table->rememberToken();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $columnsToDrop = [];

            if (Schema::hasColumn('users', 'email_verified_at')) {
                $columnsToDrop[] = 'email_verified_at';
            }
            if (Schema::hasColumn('users', 'remember_token')) {
                $columnsToDrop[] = 'remember_token';
            }

            if (! empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
