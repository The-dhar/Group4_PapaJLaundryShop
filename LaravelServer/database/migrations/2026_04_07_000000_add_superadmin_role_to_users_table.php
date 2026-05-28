<?php

use Illuminate\Database\Migrations\Migration;

/**
 * Originally added a separate `superadmin` role; that was dropped in favor of a single
 * shop owner role (`owner`) for owner@gmail.com. No schema change here — see
 * 2026_04_08_remove_superadmin_role_from_users_table if cleaning legacy ENUMs.
 */
return new class extends Migration
{
    public function up(): void
    {
        //
    }

    public function down(): void
    {
        //
    }
};
