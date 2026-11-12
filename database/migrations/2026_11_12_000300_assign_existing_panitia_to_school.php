<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Akun panitia kini WAJIB terikat ke satu sekolah (panitia tanpa sekolah tidak punya akses).
 *
 * Sebelum multi-sekolah semua panitia adalah panitia satu-satunya sekolah. Agar akun lama tidak
 * terkunci setelah deploy: bila tepat SATU sesi nyata (bukan simulasi) ada, panitia tanpa sekolah
 * ditugaskan ke sesi itu. Bila ada beberapa sesi, admin menentukan sendiri lewat menu Pengguna
 * (akun terkait menampilkan "belum ditugaskan" dan tidak bisa masuk panel sampai ditugaskan).
 */
return new class extends Migration
{
    public function up(): void
    {
        $real = DB::table('elections')->where('is_simulation', false)->pluck('id');

        if ($real->count() === 1) {
            DB::table('users')->where('role', 'panitia')->whereNull('election_id')->update(['election_id' => $real->first()]);
        }
    }

    public function down(): void
    {
        // Tidak ada yang perlu dikembalikan: penugasan sekolah tidak merusak data.
    }
};
