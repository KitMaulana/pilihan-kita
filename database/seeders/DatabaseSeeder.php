<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder akun awal. Aman dijalankan berulang (tidak menimpa akun yang sudah ada).
 * Admin bawaan: username "admin" / sandi "adminkita" — GANTI sandi ini sebelum dipakai di produksi
 * (isi SEED_ADMIN_PASSWORD di .env sebelum db:seed, atau ubah lewat menu Pengguna).
 * Panitia: sandi dari SEED_PANITIA_PASSWORD; bila kosong dibuat acak dan dicetak sekali.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['username' => 'admin', 'email' => env('SEED_ADMIN_EMAIL', 'admin@pilihankita.local'), 'name' => 'Administrator', 'role' => User::ROLE_ADMIN, 'env' => 'SEED_ADMIN_PASSWORD', 'default' => 'adminkita'],
            ['username' => 'panitia', 'email' => env('SEED_PANITIA_EMAIL', 'panitia@pilihankita.local'), 'name' => 'Panitia', 'role' => User::ROLE_PANITIA, 'env' => 'SEED_PANITIA_PASSWORD', 'default' => null],
        ];

        foreach ($accounts as $a) {
            if (User::where('email', $a['email'])->orWhere('username', $a['username'])->exists()) {
                $this->command?->line("Akun {$a['email']} sudah ada — dilewati.");

                continue;
            }
            $password = env($a['env']) ?: ($a['default'] ?? Str::password(14, symbols: false));
            User::create([
                'name' => $a['name'],
                'username' => $a['username'],
                'email' => $a['email'],
                'password' => $password,
                'role' => $a['role'],
                'is_active' => true,
            ]);
            $this->command?->info("Akun {$a['role']}: {$a['username']} / ".(env($a['env']) ? '(dari .env)' : $password));
        }

        if (app()->environment('local')) {
            $this->call(DemoSeeder::class);
        }
    }
}
