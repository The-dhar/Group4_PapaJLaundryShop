<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class OwnerSeeder extends Seeder
{
    /**
     * Default shop owner (mobile + web). Password is hashed via User model cast.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'owner@gmail.com'],
            [
                'name' => 'Shop Owner',
                'role' => 'owner',
                'password' => 'owner123',
                'is_active' => true,
            ]
        );

        User::firstOrCreate(
            ['email' => 'manager@gmail.com'],
            [
                'name' => 'Branch Manager',
                'role' => 'manager',
                'password' => 'manager123',
                'is_active' => false,
            ]
        );
    }
}