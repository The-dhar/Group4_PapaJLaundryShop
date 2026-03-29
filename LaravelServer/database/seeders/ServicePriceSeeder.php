<?php

namespace Database\Seeders;

use App\Models\ServicePrice;
use Illuminate\Database\Seeder;

class ServicePriceSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            [
                'name' => 'Regular Clothes',
                'category' => 'Wash & Fold',
                'tiers' => [
                    ['range' => '1-6 kg', 'price' => 150, 'description' => '1 cycle'],
                    ['range' => '6.1-7 kg', 'price' => 175, 'description' => 'Standard'],
                    ['range' => '7.1-8 kg', 'price' => 200, 'description' => 'Per succeeding kg'],
                ],
            ],
            [
                'name' => 'White Clothes',
                'category' => 'Wash & Fold',
                'tiers' => [
                    ['range' => '1-6 kg', 'price' => 150, 'description' => '1 cycle'],
                    ['range' => '6.1-7 kg', 'price' => 185, 'description' => 'Standard'],
                    ['range' => '7.1-8 kg', 'price' => 220, 'description' => 'Per succeeding kg'],
                ],
            ],
            [
                'name' => 'Drying Service',
                'category' => 'Dry Only',
                'tiers' => [
                    ['range' => '1-6 kg', 'price' => 120, 'description' => 'Small load'],
                    ['range' => '6.1-8 kg', 'price' => 150, 'description' => 'Medium load'],
                ],
            ],
            [
                'name' => 'Penalty',
                'category' => 'Misc',
                'tiers' => [
                    ['range' => 'Penalty', 'price' => 100, 'description' => 'Penalty fee'],
                ],
            ],
        ];

        foreach ($defaults as $service) {
            ServicePrice::firstOrCreate(
                ['name' => $service['name']],
                [
                    'category' => $service['category'],
                    'tiers' => $service['tiers'],
                ]
            );
        }
    }
}
