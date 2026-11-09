<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder akun awal. Aman dijalankan SEKALI di produksi (idempoten: tidak menimpa akun yang ada).
 * Kata sandi diambil dari .env (SEED_ADMIN_PASSWORD / SEED_PANITIA_PASSWORD);
 * bila kosong, dibuat acak dan dicetak ke konsol.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['email' => env('SEED_ADMIN_EMAIL', 'admin@pilihankita.local'), 'name' => 'Administrator', 'role' => User::ROLE_ADMIN, 'env' => 'SEED_ADMIN_PASSWORD'],
            ['email' => env('SEED_PANITIA_EMAIL', 'panitia@pilihankita.local'), 'name' => 'Panitia', 'role' => User::ROLE_PANITIA, 'env' => 'SEED_PANITIA_PASSWORD'],
        ];

        foreach ($accounts as $a) {
            if (User::where('email', $a['email'])->exists()) {
                $this->command?->line("Akun {$a['email']} sudah ada — dilewati.");

                continue;
            }
            $password = env($a['env']) ?: Str::password(14, symbols: false);
            User::create([
                'name' => $a['name'],
                'email' => $a['email'],
                'password' => $password,
                'role' => $a['role'],
                'is_active' => true,
            ]);
            $this->command?->info("Akun {$a['role']}: {$a['email']} / ".(env($a['env']) ? '(dari .env)' : $password));
        }

        if (app()->environment('local')) {
            $this->call(DemoSeeder::class);
        }
    }
}
