<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE transactions
            MODIFY COLUMN inventory_status
            ENUM('in_shop','picked_up','backjob')
            NOT NULL
            DEFAULT 'in_shop'
        ");
    }

    public function down(): void
    {
        // Prevent enum rollback failure by remapping unsupported value first.
        DB::statement("UPDATE transactions SET inventory_status = 'in_shop' WHERE inventory_status = 'backjob'");

        DB::statement("
            ALTER TABLE transactions
            MODIFY COLUMN inventory_status
            ENUM('in_shop','picked_up')
            NOT NULL
            DEFAULT 'in_shop'
        ");
    }
};
