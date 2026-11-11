<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * MULTI-SEKOLAH: satu "sesi" = satu pemilihan untuk satu sekolah (tabel elections).
 * Banyak sesi boleh berjalan bersamaan; data tiap sesi terpisah.
 *
 *  - elections.school_name, elections.slug (untuk /hasil/{slug})
 *  - voters.election_id      → daftar pemilih per sesi (NISN unik per sesi, bukan global)
 *  - kiosk_devices.election_id → tablet/laptop terdaftar untuk satu sesi
 *  - users.election_id       → panitia dapat dibatasi ke satu sesi (null = semua sesi)
 *  - activity_logs.election_id
 *
 * Data lama diisi otomatis: pemilih nyata → sesi nyata terbaru, pemilih simulasi → sesi simulasi terbaru.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('elections', function (Blueprint $table) {
            $table->string('school_name', 150)->nullable()->after('name');
            $table->string('slug', 80)->nullable()->unique()->after('school_name');
        });

        Schema::table('voters', function (Blueprint $table) {
            $table->foreignId('election_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
        });

        Schema::table('kiosk_devices', function (Blueprint $table) {
            $table->foreignId('election_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('election_id')->nullable()->after('role')->constrained()->nullOnDelete();
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('election_id')->nullable()->after('user_id')->index();
        });

        $this->backfill();

        // NISN/NIP unik PER SESI (siswa yang sama boleh ada di sesi lain, mis. simulasi / tahun berikutnya).
        Schema::table('voters', function (Blueprint $table) {
            $table->dropUnique(['type', 'identifier']);
            $table->unique(['election_id', 'type', 'identifier']);
        });
    }

    private function backfill(): void
    {
        $now = now();

        // Terbaru lebih dulu → sesi aktif mendapat tautan bersih (mis. /hasil/sman-1-ciruas).
        foreach (DB::table('elections')->orderByDesc('id')->get() as $e) {
            $school = $e->is_simulation ? 'Simulasi' : (str_contains((string) $e->name, 'Ciruas') ? 'SMAN 1 Ciruas' : 'Sekolah');
            $slug = Str::slug($school);
            if (DB::table('elections')->where('slug', $slug)->exists()) {
                $slug .= '-'.$e->id; // sesi lama berikutnya dari sekolah yang sama
            }
            DB::table('elections')->where('id', $e->id)->update(['school_name' => $school, 'slug' => $slug]);
        }

        foreach ([false, true] as $sim) {
            if (! DB::table('voters')->where('is_simulation', $sim)->whereNull('election_id')->exists()) {
                continue;
            }
            $electionId = DB::table('elections')->where('is_simulation', $sim)->orderByDesc('id')->value('id');
            if (! $electionId) {
                $school = $sim ? 'Simulasi' : 'Sekolah';
                $electionId = DB::table('elections')->insertGetId([
                    'name' => $sim ? 'SIMULASI Pemilihan Ketua OSIS' : 'Pemilihan Ketua OSIS',
                    'school_name' => $school,
                    'status' => 'draft',
                    'is_simulation' => $sim,
                    'settings' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('elections')->where('id', $electionId)->update(['slug' => Str::slug($school).'-'.$electionId]);
            }
            DB::table('voters')->where('is_simulation', $sim)->whereNull('election_id')->update(['election_id' => $electionId]);
        }

        // Tablet lama → sesi nyata terbaru (atau sesi apa pun yang terbaru).
        $deviceElection = DB::table('elections')->where('is_simulation', false)->orderByDesc('id')->value('id')
            ?? DB::table('elections')->orderByDesc('id')->value('id');
        if ($deviceElection) {
            DB::table('kiosk_devices')->whereNull('election_id')->update(['election_id' => $deviceElection]);
        }
    }

    public function down(): void
    {
        // MySQL memakai indeks unik komposit sebagai indeks foreign key → lepas FK dulu.
        Schema::table('voters', fn (Blueprint $t) => $t->dropForeign(['election_id']));
        Schema::table('voters', function (Blueprint $table) {
            $table->dropUnique(['election_id', 'type', 'identifier']);
            $table->dropColumn('election_id');
            $table->unique(['type', 'identifier']); // gagal bila NISN yang sama sudah ada di beberapa sesi
        });
        Schema::table('activity_logs', fn (Blueprint $t) => $t->dropColumn('election_id'));
        Schema::table('users', fn (Blueprint $t) => $t->dropConstrainedForeignId('election_id'));
        Schema::table('kiosk_devices', fn (Blueprint $t) => $t->dropConstrainedForeignId('election_id'));
        Schema::table('elections', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['school_name', 'slug']);
        });
    }
};
