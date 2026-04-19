<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('issue_reports')) {
            return;
        }

        Schema::table('issue_reports', function (Blueprint $table) {
            if (! Schema::hasColumn('issue_reports', 'affected_transaction_item_ids')) {
                $table->json('affected_transaction_item_ids')->nullable()->after('transaction_item_id');
            }
            if (! Schema::hasColumn('issue_reports', 'refund_allocations')) {
                $table->json('refund_allocations')->nullable()->after('refund_amount');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issue_reports')) {
            return;
        }

        Schema::table('issue_reports', function (Blueprint $table) {
            if (Schema::hasColumn('issue_reports', 'refund_allocations')) {
                $table->dropColumn('refund_allocations');
            }
            if (Schema::hasColumn('issue_reports', 'affected_transaction_item_ids')) {
                $table->dropColumn('affected_transaction_item_ids');
            }
        });
    }
};
