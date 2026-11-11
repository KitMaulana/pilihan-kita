<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Alur dua tahap: CHECK-IN (wajah/NISN, tahu identitas) → BILIK SUARA (tidak tahu identitas).
 *
 * booth_credits = "hak masuk bilik" anonim yang diterbitkan saat check-in dan dipakai satu kali
 * saat suara dikirim dari bilik. SENGAJA tanpa voter_id, tanpa device_id, tanpa created_at,
 * id UUIDv4 acak — sehingga suara di bilik tidak bisa ditelusuri ke pemilih mana pun.
 * Urutan antrean memakai expires_at (TTL sama untuk semua → FIFO).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kiosk_devices', function (Blueprint $table) {
            $table->string('role', 10)->default('checkin')->after('name'); // checkin | booth
        });

        Schema::create('booth_credits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('election_id')->constrained()->cascadeOnDelete();
            $table->timestamp('expires_at');

            $table->index(['election_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booth_credits');
        Schema::table('kiosk_devices', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
