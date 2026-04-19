<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_items', function (Blueprint $table) {
            if (! Schema::hasColumn('transaction_items', 'piece_count')) {
                $table->unsignedInteger('piece_count')->nullable()->after('total');
            }
        });

        if (! Schema::hasTable('issue_reports')) {
            return;
        }

        Schema::table('issue_reports', function (Blueprint $table) {
            if (! Schema::hasColumn('issue_reports', 'transaction_item_id')) {
                $table->foreignId('transaction_item_id')
                    ->nullable()
                    ->after('transaction_id')
                    ->constrained('transaction_items')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('issue_reports', 'refund_amount')) {
                $table->decimal('refund_amount', 10, 2)->nullable()->after('resolution_note');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('issue_reports')) {
            Schema::table('issue_reports', function (Blueprint $table) {
                if (Schema::hasColumn('issue_reports', 'refund_amount')) {
                    $table->dropColumn('refund_amount');
                }
            });
            Schema::table('issue_reports', function (Blueprint $table) {
                if (Schema::hasColumn('issue_reports', 'transaction_item_id')) {
                    $table->dropForeign(['transaction_item_id']);
                    $table->dropColumn('transaction_item_id');
                }
            });
        }

        Schema::table('transaction_items', function (Blueprint $table) {
            if (Schema::hasColumn('transaction_items', 'piece_count')) {
                $table->dropColumn('piece_count');
            }
        });
    }
};
