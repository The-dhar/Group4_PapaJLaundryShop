<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

class OwnerSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'owner@gmail.com'],
            [
                'name' => 'Shop Owner',
                'role' => 'owner',
                'password' => 'owner123',
            ]
        );

        User::firstOrCreate(
            ['email' => 'manager@gmail.com'],
            [
                'name' => 'Branch Manager',
                'role' => 'manager',
                'password' => 'manager123',
            ]
        );
    }
}