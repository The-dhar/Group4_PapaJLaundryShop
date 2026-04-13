<?php

use App\Models\Branch;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->user = User::factory()->create([
        'role' => 'manager',
    ]);

    $this->branch = Branch::create([
        'name' => 'Main Branch',
        'is_active' => true,
    ]);

    Sanctum::actingAs($this->user);
});

function makePenaltyTransaction(Branch $branch, array $overrides = []): Transaction
{
    return Transaction::create(array_merge([
        'receipt_number' => 'RCPT-10001',
        'branch_id' => $branch->id,
        'customer_name' => 'Penalty Test Customer',
        'customer_address' => 'Test Address',
        'total_weight' => 5,
        'subtotal' => 200,
        'extras' => 0,
        'total_amount' => 200,
        'payment_status' => 'unpaid',
        'payment_method' => 'Cash',
        'paid_amount' => 0,
        'penalty_amount' => 0,
        'penalty_suggested_amount' => 0,
        'inventory_status' => 'in_shop',
        'due_date' => Carbon::now()->subDays(35)->toDateString(),
        'archived' => false,
        'is_rush' => false,
    ], $overrides));
}

it('requires an override reason when penalty is below suggested amount', function () {
    $txn = makePenaltyTransaction($this->branch);

    $response = $this->putJson("/api/transactions/{$txn->id}/update-payment", [
        'paid_amount' => 300,
        'penalty_amount' => 100,
        'payment_method' => 'Cash',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['penalty_override_reason']);
});

it('stores penalty override metadata when penalty is below suggested with reason', function () {
    $txn = makePenaltyTransaction($this->branch);

    $response = $this->putJson("/api/transactions/{$txn->id}/update-payment", [
        'paid_amount' => 300,
        'penalty_amount' => 100,
        'penalty_override_reason' => 'Customer loyalty discount approved by clerk',
        'payment_method' => 'Cash',
    ]);

    $response->assertOk();

    $txn->refresh();

    expect((float) $txn->paid_amount)->toBe(300.0)
        ->and((float) $txn->penalty_amount)->toBe(100.0)
        ->and((float) $txn->penalty_suggested_amount)->toBe(200.0)
        ->and($txn->penalty_override_reason)->toBe('Customer loyalty discount approved by clerk');
});

it('prevents mark-paid when paid amount does not cover amount plus penalty', function () {
    $txn = makePenaltyTransaction($this->branch, [
        'paid_amount' => 250,
        'penalty_amount' => 100,
        'penalty_suggested_amount' => 200,
        'penalty_override_reason' => 'Approved reduction for damaged garment',
    ]);

    $response = $this->putJson("/api/transactions/{$txn->id}/mark-paid");

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['paid_amount']);

    $txn->refresh();
    expect($txn->payment_status)->toBe('unpaid');
});
