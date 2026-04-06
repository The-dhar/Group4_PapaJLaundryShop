<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('branches') || ! Schema::hasTable('users')) {
            return;
        }

        $existing = DB::table('branches')->whereNotNull('legacy_manager_user_id')->count();
        if ($existing === 0) {
            $managers = DB::table('users')->where('role', 'manager')->get();
            foreach ($managers as $m) {
                DB::table('branches')->insert([
                    'name' => $m->name,
                    'legacy_manager_user_id' => $m->id,
                    'clerk_username' => $m->clerk_username ?? null,
                    'is_active' => isset($m->is_active) ? (bool) $m->is_active : true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        $this->repointTable('transactions');
        $this->repointTable('customers');
        $this->repointTable('employees');
        $this->repointTable('employee_branch_histories');
    }

    public function down(): void
    {
        if (! Schema::hasTable('branches')) {
            return;
        }

        $this->revertTable('transactions');
        $this->revertTable('customers');
        $this->revertTable('employees');
        $this->revertTable('employee_branch_histories');
    }

    protected function repointTable(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'branch_id')) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) {
            try {
                $blueprint->dropForeign(['branch_id']);
            } catch (\Throwable) {
                // SQLite / already dropped
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("
                UPDATE `{$table}` AS t
                INNER JOIN branches AS b ON b.legacy_manager_user_id = t.branch_id
                SET t.branch_id = b.id
            ");
        } else {
            DB::statement("
                UPDATE {$table}
                SET branch_id = (
                    SELECT id FROM branches WHERE legacy_manager_user_id = {$table}.branch_id
                )
                WHERE branch_id IS NOT NULL
                AND branch_id IN (SELECT legacy_manager_user_id FROM branches)
            ");
        }

        $onDelete = match ($table) {
            'transactions' => 'cascade',
            default => null,
        };

        Schema::table($table, function (Blueprint $blueprint) use ($onDelete) {
            $fk = $blueprint->foreign('branch_id')->references('id')->on('branches');
            if ($onDelete === 'cascade') {
                $fk->cascadeOnDelete();
            } else {
                $fk->nullOnDelete();
            }
        });
    }

    protected function revertTable(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'branch_id')) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) {
            try {
                $blueprint->dropForeign(['branch_id']);
            } catch (\Throwable) {
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("
                UPDATE `{$table}` AS t
                INNER JOIN branches AS b ON b.id = t.branch_id
                SET t.branch_id = b.legacy_manager_user_id
            ");
        } else {
            DB::statement("
                UPDATE {$table}
                SET branch_id = (
                    SELECT legacy_manager_user_id FROM branches WHERE id = {$table}.branch_id
                )
                WHERE branch_id IS NOT NULL
                AND branch_id IN (SELECT id FROM branches)
            ");
        }

        $onDelete = $table === 'transactions' ? 'cascade' : null;
        Schema::table($table, function (Blueprint $blueprint) use ($onDelete) {
            $fk = $blueprint->foreign('branch_id')->references('id')->on('users');
            if ($onDelete === 'cascade') {
                $fk->cascadeOnDelete();
            } else {
                $fk->nullOnDelete();
            }
        });
    }
};
