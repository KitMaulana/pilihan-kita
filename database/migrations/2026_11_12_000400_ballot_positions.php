<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Skema surat suara per sekolah (elections.settings.ballot_mode):
 *  - pair     : ketua & wakil satu pasangan → kandidat berjabatan "pair", satu pilihan.
 *  - separate : ketua & wakil dipilih terpisah → kandidat berjabatan "ketua" / "wakil", dua pilihan.
 *
 * votes.position mencatat jabatan setiap suara. Pada skema terpisah satu surat suara menghasilkan dua baris
 * (ketua & wakil) dengan KODE RESI YANG SAMA, sehingga keunikan resi kini per (resi, jabatan).
 * Data lama otomatis berjabatan "pair" (skema berpasangan, perilaku sebelumnya).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            $table->string('position', 10)->default('pair')->after('election_id');
            $table->index(['election_id', 'position']);
        });
        // Nomor urut unik PER JABATAN (ketua No. 1 dan wakil No. 1 boleh berdampingan).
        // Indeks baru dibuat lebih dulu agar foreign key election_id tetap punya indeks di MySQL.
        Schema::table('candidates', function (Blueprint $table) {
            $table->unique(['election_id', 'position', 'number']);
        });
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropUnique(['election_id', 'number']);
        });

        Schema::table('votes', function (Blueprint $table) {
            $table->string('position', 10)->default('pair')->after('candidate_id');
            $table->dropUnique(['receipt_code']);
            $table->unique(['receipt_code', 'position']);
            $table->index(['election_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::table('votes', function (Blueprint $table) {
            $table->dropIndex(['election_id', 'position']);
            $table->dropUnique(['receipt_code', 'position']);
            $table->unique(['receipt_code']); // gagal bila sudah ada surat suara skema terpisah
            $table->dropColumn('position');
        });
        Schema::table('candidates', function (Blueprint $table) {
            $table->unique(['election_id', 'number']); // gagal bila ketua & wakil berbagi nomor
        });
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropUnique(['election_id', 'position', 'number']);
            $table->dropIndex(['election_id', 'position']);
            $table->dropColumn('position');
        });
    }
};
