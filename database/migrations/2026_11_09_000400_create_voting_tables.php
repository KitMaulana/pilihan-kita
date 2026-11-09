<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SUARA — tanpa identitas, tanpa timestamp, id UUIDv4 acak.
        // seq/prev_hash/hash diisi saat "penyegelan" batch (urutan diacak),
        // sehingga urutan ledger tidak sama dengan urutan kedatangan pemilih.
        Schema::create('votes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('election_id')->constrained()->cascadeOnDelete();
            $table->foreignId('candidate_id')->constrained()->restrictOnDelete();
            $table->string('receipt_code', 20)->unique();
            $table->string('nonce', 32);
            $table->unsignedInteger('seq')->nullable();
            $table->string('prev_hash', 64)->nullable();
            $table->string('hash', 64)->nullable();

            $table->unique(['election_id', 'seq']);
            $table->index(['election_id', 'candidate_id']);
        });

        // PENANDA "SUDAH MEMILIH" — terpisah, tanpa waktu, tanpa auto-increment.
        // Primary key komposit = jaminan DB satu orang satu suara.
        Schema::create('voter_turnouts', function (Blueprint $table) {
            $table->foreignId('election_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voter_id')->constrained()->cascadeOnDelete();
            $table->primary(['election_id', 'voter_id']);
        });

        // Tiket sesi kiosk (teridentifikasi -> terkonfirmasi). Dihapus saat dipakai.
        Schema::create('ballot_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->foreignId('election_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voter_id')->constrained()->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('kiosk_devices')->nullOnDelete();
            $table->string('method', 10); // face | fallback
            $table->string('stage', 12); // identified | confirmed
            $table->timestamp('expires_at');
        });

        Schema::create('access_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('election_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('voter_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('kiosk_devices')->nullOnDelete();
            $table->string('method', 10); // face | fallback
            $table->string('result', 20); // matched | not_matched | ambiguous | already_voted | locked | liveness_failed | rejected | wrong_data
            $table->string('reason')->nullable();
            $table->boolean('is_suspicious')->default(false);
            $table->float('score_top')->nullable();
            $table->float('score_margin')->nullable();
            $table->timestamp('created_at')->nullable(); // dibulatkan ke menit

            $table->index(['device_id', 'created_at']);
            $table->index(['result', 'created_at']);
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 60);
            $table->string('subject_type', 60)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('details')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('access_attempts');
        Schema::dropIfExists('ballot_tickets');
        Schema::dropIfExists('voter_turnouts');
        Schema::dropIfExists('votes');
    }
};
