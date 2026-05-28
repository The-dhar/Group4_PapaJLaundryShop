<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        $hasPenaltyAmount = Schema::hasColumn('transactions', 'penalty_amount');
        $hasPenaltySuggestedAmount = Schema::hasColumn('transactions', 'penalty_suggested_amount');
        $hasPenaltyOverrideReason = Schema::hasColumn('transactions', 'penalty_override_reason');

        if ($hasPenaltyAmount && $hasPenaltySuggestedAmount && $hasPenaltyOverrideReason) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) use ($hasPenaltyAmount, $hasPenaltySuggestedAmount, $hasPenaltyOverrideReason) {
            if (! $hasPenaltyAmount) {
                $table->decimal('penalty_amount', 10, 2)->default(0);
            }

            if (! $hasPenaltySuggestedAmount) {
                $table->decimal('penalty_suggested_amount', 10, 2)->default(0);
            }

            if (! $hasPenaltyOverrideReason) {
                $table->string('penalty_override_reason', 500)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('transactions')) {
            return;
        }

        $hasPenaltyAmount = Schema::hasColumn('transactions', 'penalty_amount');
        $hasPenaltySuggestedAmount = Schema::hasColumn('transactions', 'penalty_suggested_amount');
        $hasPenaltyOverrideReason = Schema::hasColumn('transactions', 'penalty_override_reason');

        if (! $hasPenaltyAmount && ! $hasPenaltySuggestedAmount && ! $hasPenaltyOverrideReason) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) use ($hasPenaltyAmount, $hasPenaltySuggestedAmount, $hasPenaltyOverrideReason) {
            $dropColumns = [];

            if ($hasPenaltyAmount) {
                $dropColumns[] = 'penalty_amount';
            }

            if ($hasPenaltySuggestedAmount) {
                $dropColumns[] = 'penalty_suggested_amount';
            }

            if ($hasPenaltyOverrideReason) {
                $dropColumns[] = 'penalty_override_reason';
            }

            if (! empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
