<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

class OwnerSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Shop Owner',
            'email' => 'owner@gmail.com',
            'role' => 'owner',
            'password' => 'owner123', 
        ]);
    }
}