<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hak masuk bilik TIDAK lagi hangus oleh waktu: pemilih yang sudah check-in pasti memilih.
 * Kolom expires_at hanya dipakai untuk urutan antrean (FIFO), maka diganti nama menjadi queued_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booth_credits', function (Blueprint $table) {
            $table->renameColumn('expires_at', 'queued_at');
        });
    }

    public function down(): void
    {
        Schema::table('booth_credits', function (Blueprint $table) {
            $table->renameColumn('queued_at', 'expires_at');
        });
    }
};
