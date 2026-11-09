<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // CATATAN PRIVASI: tabel ini sengaja TIDAK punya updated_at.
        // Bila ada, kolom itu berubah saat has_voted di-set dan menjadi
        // timestamp presisi "kapan orang ini memilih" (melanggar §5.2).
        Schema::create('voters', function (Blueprint $table) {
            $table->id();
            $table->string('type', 10); // student | teacher
            $table->string('identifier', 30)->nullable(); // NISN / NIP
            $table->string('name');
            $table->string('class_name', 50)->nullable();
            $table->date('birth_date');
            $table->string('distinguisher', 50)->nullable(); // pembeda guru tanpa NIP (mis. kode guru)
            $table->boolean('is_active')->default(true);
            $table->boolean('has_voted')->default(false);
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestamp('locked_at')->nullable();
            $table->boolean('is_simulation')->default(false);
            $table->timestamp('created_at')->nullable();

            $table->unique(['type', 'identifier']);
            $table->index(['name', 'birth_date']);
            $table->index('class_name');
        });

        Schema::create('face_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voter_id')->unique()->constrained()->cascadeOnDelete();
            $table->binary('embedding'); // float32 LE x 512, ternormalisasi L2
            $table->string('model_version', 50);
            $table->float('quality_score')->nullable();
            $table->foreignId('duplicate_of_voter_id')->nullable()->constrained('voters')->nullOnDelete();
            $table->float('duplicate_score')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('face_templates');
        Schema::dropIfExists('voters');
    }
};
