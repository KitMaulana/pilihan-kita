<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bilik "memesan" satu hak masuk sebelum menampilkan surat suara.
 *
 * claimed_by = perangkat BILIK yang memegang hak masuk ini (null = masih antre). Hak masuk tetap
 * anonim: tidak ada voter_id, tidak ada perangkat check-in; kolom ini hanya menunjuk bilik yang
 * sedang "menyala", dan hilang bersama barisnya saat suara dikirim.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booth_credits', function (Blueprint $table) {
            $table->foreignId('claimed_by')->nullable()->after('election_id')->constrained('kiosk_devices')->nullOnDelete();
            $table->index(['election_id', 'claimed_by']);
        });
    }

    public function down(): void
    {
        Schema::table('booth_credits', function (Blueprint $table) {
            $table->dropIndex(['election_id', 'claimed_by']);
            $table->dropConstrainedForeignId('claimed_by');
        });
    }
};
