<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // PostgreSQL-compatible: replace existing inventory_status CHECK with one that includes backjob.
        DB::unprepared("
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN
                    SELECT c.conname, n.nspname, t.relname
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE t.relname = 'transactions'
                      AND c.contype = 'c'
                      AND pg_get_constraintdef(c.oid) LIKE '%inventory_status%'
                LOOP
                    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
                END LOOP;
            END
            $$;
        ");

        DB::statement("
            ALTER TABLE transactions
            ADD CONSTRAINT transactions_inventory_status_check
            CHECK (inventory_status IN ('in_shop', 'picked_up', 'backjob'))
        ");
    }

    public function down(): void
    {
        // Remap backjob rows before restoring the older check.
        DB::statement("UPDATE transactions SET inventory_status = 'in_shop' WHERE inventory_status = 'backjob'");

        DB::unprepared("
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN
                    SELECT c.conname, n.nspname, t.relname
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE t.relname = 'transactions'
                      AND c.contype = 'c'
                      AND pg_get_constraintdef(c.oid) LIKE '%inventory_status%'
                LOOP
                    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
                END LOOP;
            END
            $$;
        ");

        DB::statement("
            ALTER TABLE transactions
            ADD CONSTRAINT transactions_inventory_status_check
            CHECK (inventory_status IN ('in_shop', 'picked_up'))
        ");
    }
};
