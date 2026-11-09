<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('elections', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('status', 20)->default('draft'); // draft | open | closed | published
            $table->timestamp('opens_at')->nullable();
            $table->timestamp('closes_at')->nullable();
            $table->json('settings')->nullable();
            $table->boolean('is_simulation')->default(false);
            $table->string('ledger_head_hash', 64)->nullable();
            $table->unsignedInteger('ledger_count')->default(0);
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('elections');
    }
};
