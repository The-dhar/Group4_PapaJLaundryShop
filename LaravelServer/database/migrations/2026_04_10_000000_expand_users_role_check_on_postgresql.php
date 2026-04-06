<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * On PostgreSQL, Laravel's enum() columns are implemented as varchar + CHECK (role in (...)).
 * The staff migrations only expanded ENUM for MySQL, so clerk/staff inserts failed on Render (pgsql).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        $constraints = DB::select("
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = current_schema()
              AND t.relname = 'users'
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) ILIKE '%role%'
        ");

        foreach ($constraints as $row) {
            $name = $row->conname ?? null;
            if (is_string($name) && $name !== '') {
                DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS "' . str_replace('"', '""', $name) . '"');
            }
        }

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_allowed CHECK (role IN ('owner', 'manager', 'clerk', 'staff'))");
    }

    public function down(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed');

        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_allowed CHECK (role IN ('owner', 'manager'))");
    }
};
