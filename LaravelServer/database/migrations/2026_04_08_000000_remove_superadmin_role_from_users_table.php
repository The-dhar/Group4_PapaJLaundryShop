<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shop access uses role `owner` only (owner@gmail.com). Removes legacy `superadmin` from MySQL ENUM.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::table('users')->where('role', 'superadmin')->update(['role' => 'owner']);
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('owner','manager','clerk','staff') NOT NULL DEFAULT 'manager'");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('owner','superadmin','manager','clerk','staff') NOT NULL DEFAULT 'manager'");
        }
    }
};
