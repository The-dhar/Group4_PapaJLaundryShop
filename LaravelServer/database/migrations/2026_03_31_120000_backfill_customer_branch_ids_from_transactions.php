<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Assign branch_id to legacy customers (branch_id null) by matching the normalized
     * display name to the most recent transaction with that customer_name.
     */
    public function up(): void
    {
        if (! Schema::hasTable('customers') || ! Schema::hasTable('transactions')) {
            return;
        }

        if (! Schema::hasColumn('customers', 'branch_id')) {
            return;
        }

        $normalize = static function (?string $name): string {
            $t = trim((string) $name);

            return $t === '' ? '' : (string) preg_replace('/\s+/u', ' ', $t);
        };

        $transactions = DB::table('transactions')
            ->whereNotNull('branch_id')
            ->orderByDesc('id')
            ->get(['customer_name', 'branch_id']);

        $nameToBranchId = [];
        foreach ($transactions as $row) {
            $key = $normalize($row->customer_name ?? '');
            if ($key === '') {
                continue;
            }
            if (! isset($nameToBranchId[$key])) {
                $nameToBranchId[$key] = (int) $row->branch_id;
            }
        }

        $customers = DB::table('customers')
            ->whereNull('branch_id')
            ->get(['id', 'name']);

        $now = now();
        foreach ($customers as $customer) {
            $key = $normalize($customer->name ?? '');
            if ($key === '' || ! isset($nameToBranchId[$key])) {
                continue;
            }

            DB::table('customers')->where('id', $customer->id)->update([
                'branch_id' => $nameToBranchId[$key],
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Irreversible: we cannot know which rows were backfilled vs set intentionally.
    }
};
