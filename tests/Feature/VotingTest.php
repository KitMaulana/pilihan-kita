<?php

namespace Tests\Feature;

use App\Models\BoothCredit;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use App\Services\LedgerService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Alur dua tahap: meja CHECK-IN (tahu identitas) → BILIK SUARA (tidak tahu identitas). */
class VotingTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkin_wajah_lalu_memilih_di_bilik_menghasilkan_resi(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $voter = $this->voterWithFace(1);

        // Bilik belum siap sebelum ada yang check-in.
        $this->postJson('/api/v1/kiosk/booth/claim', [], $booth)->assertOk()->assertJson(['ready' => false, 'waiting' => 0]);

        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $checkin)->assertOk()->json('ticket');
        $res = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $checkin)
            ->assertOk()->assertJsonPath('checked_in', true);
        $this->assertArrayNotHasKey('vote_token', $res->json(), 'Meja check-in tidak boleh menerima token suara.');

        $this->assertTrue($voter->fresh()->has_voted);
        $this->assertDatabaseHas('voter_turnouts', ['election_id' => $election->id, 'voter_id' => $voter->id]);
        // Bilik memesan hak masuk yang baru terbit: surat suara boleh tampil di bilik ini.
        $this->postJson('/api/v1/kiosk/booth/claim', [], $booth)->assertJson(['ready' => true, 'holding' => true, 'waiting' => 0, 'in_booths' => 1]);

        $vote = $this->boothVote($booth, $election->candidates()->first()->id)->assertCreated();
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/', $vote->json('receipt_code'));
        $this->assertSame(1, Vote::count());
        $this->assertSame(0, BoothCredit::count(), 'Hak masuk bilik habis setelah dipakai.');
        $this->postJson('/api/v1/kiosk/booth/claim', [], $booth)->assertJson(['ready' => false, 'in_booths' => 0]);
    }

    public function test_bilik_menolak_suara_tanpa_checkin_dan_satu_checkin_satu_suara(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $cid = $election->candidates()->first()->id;

        $this->boothVote($booth, $cid)->assertStatus(409)->assertJsonPath('code', 'no_checkin');

        $voter = Voter::factory()->create();
        $this->checkInByNisn($checkin, $voter->identifier);
        $this->boothVote($booth, $cid)->assertCreated();
        $this->boothVote($booth, $cid)->assertStatus(409)->assertJsonPath('code', 'no_checkin');

        $this->assertSame(1, Vote::count());
    }

    public function test_pemilih_tidak_bisa_checkin_dua_kali(): void
    {
        $this->openElection();
        [, $checkin] = $this->device();
        $voter = Voter::factory()->create();
        $this->checkInByNisn($checkin, $voter->identifier);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => $voter->identifier, 'birth_date' => '2008-05-17'], $checkin)
            ->assertStatus(409)->assertJsonPath('code', 'already_voted');
        $this->assertSame(1, BoothCredit::count());
    }

    public function test_peran_perangkat_dipisah(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->voterWithFace(1);

        // Bilik tidak bisa mengidentifikasi pemilih.
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $booth)->assertStatus(403)->assertJsonPath('code', 'wrong_device_role');
        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0070000001', 'birth_date' => '2008-05-17'], $booth)->assertStatus(403);
        // Meja check-in tidak bisa memungut suara / melihat surat suara.
        $this->boothVote($checkin, $election->candidates()->first()->id)->assertStatus(403)->assertJsonPath('code', 'wrong_device_role');
        $this->getJson('/api/v1/kiosk/candidates', $checkin)->assertStatus(403);
        // Status umum boleh untuk keduanya dan memberi tahu perannya.
        $this->getJson('/api/v1/kiosk/status', $booth)->assertOk()->assertJsonPath('device.role', 'booth');
        $this->getJson('/api/v1/kiosk/status', $checkin)->assertOk()->assertJsonPath('device.role', 'checkin');
    }

    public function test_hak_masuk_bilik_tidak_hangus_oleh_waktu(): void
    {
        $election = $this->openElection();
        $election->update(["closes_at" => now()->addDays(5)]);
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);

        // Pemilih yang sudah check-in pasti memilih: berapa lama pun ia berada di bilik / menunggu.
        $this->travel(3)->days();
        $this->postJson("/api/v1/kiosk/booth/claim", [], $booth)->assertJson(["ready" => true, "in_booths" => 1]);
        $this->boothVote($booth, $election->candidates()->first()->id)->assertCreated();

        $r = app(LedgerService::class)->verify($election);
        $this->assertTrue($r["ok"], implode("; ", $r["errors"]));
        $this->assertSame(0, $r["credits_waiting"]);
    }

    public function test_pengiriman_ulang_dengan_idempotency_key_sama_tidak_memakai_dua_hak_masuk(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $cid = $election->candidates()->first()->id;
        $key = (string) Str::uuid();

        $first = $this->boothVote($booth, $cid, $key)->assertCreated()->json('receipt_code');
        $this->boothVote($booth, $cid, $key)->assertOk()->assertJsonPath('receipt_code', $first)->assertJsonPath('replayed', true);

        $this->assertSame(1, Vote::count());
        $this->assertSame(1, BoothCredit::count(), 'Hak masuk pemilih kedua tidak boleh terpakai oleh pengiriman ulang.');
    }

    public function test_constraint_database_menjamin_satu_orang_satu_checkin(): void
    {
        $election = $this->openElection();
        $voter = Voter::factory()->create();
        DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);
        try {
            DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);
            $this->fail('Primary key voter_turnouts seharusnya menolak duplikat.');
        } catch (QueryException) {
            $this->assertSame(1, DB::table('voter_turnouts')->count());
        }
    }

    public function test_kandidat_dari_pemilihan_lain_ditolak(): void
    {
        $other = Election::create(['name' => 'Lama', 'status' => Election::PUBLISHED]);
        $foreign = Candidate::create(['election_id' => $other->id, 'number' => 1, 'name' => 'X']);
        $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);

        $this->boothVote($booth, $foreign->id)->assertStatus(422)->assertJsonPath('code', 'invalid_candidate');
        $this->assertSame(1, BoothCredit::count(), 'Kandidat salah tidak boleh menghabiskan hak masuk.');
    }

    public function test_suara_tidak_bisa_dikaitkan_ke_pemilih(): void
    {
        $columns = Schema::getColumnListing('votes');
        foreach (['voter_id', 'nisn', 'nip', 'identifier', 'created_at', 'updated_at', 'device_id', 'user_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns, "Kolom {$forbidden} tidak boleh ada di votes");
        }
        // Hak masuk bilik juga tanpa identitas & tanpa waktu pembuatan.
        $creditColumns = Schema::getColumnListing('booth_credits');
        foreach (['voter_id', 'device_id', 'created_at', 'ticket_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $creditColumns, "Kolom {$forbidden} tidak boleh ada di booth_credits");
        }
        $this->assertNotContains('updated_at', Schema::getColumnListing('voters'));
        $this->assertNotContains('created_at', Schema::getColumnListing('voter_turnouts'));
        $this->assertNotContains('id', Schema::getColumnListing('voter_turnouts'));

        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $res = $this->boothVote($booth, $election->candidates()->first()->id);

        // Respons bilik tidak memuat data pemilih apa pun.
        foreach (['name', 'class_name', 'identifier', 'voter'] as $leak) {
            $this->assertArrayNotHasKey($leak, $res->json());
        }
        $vote = Vote::first();
        $this->assertTrue(Str::isUuid($vote->id));
        $this->assertSame('4', $vote->id[14], 'ID suara harus UUIDv4 (acak), bukan v7 (memuat waktu)');
    }

    public function test_ledger_disegel_per_batch_dan_terverifikasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 3]);
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $cids = $election->candidates()->pluck('id')->all();

        for ($i = 0; $i < 7; $i++) {
            $voter = Voter::factory()->create(['identifier' => '00700000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT)]);
            $this->checkInByNisn($checkin, $voter->identifier);
            $this->boothVote($booth, $cids[$i % 2])->assertCreated();
        }

        // 7 suara, batch 3 → 6 tersegel, 1 menunggu (hanya urutan ledger; hasil langsung tetap 7).
        $this->assertSame(6, Vote::whereNotNull('seq')->count());
        $ledger = app(LedgerService::class);
        $r = $ledger->verify($election);
        $this->assertTrue($r['ok'], implode('; ', $r['errors']));
        $this->assertSame(1, $r['pending']);

        $this->artisan('votes:verify-ledger')->assertExitCode(0);

        $this->actingAs($this->panitia())->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])->assertOk();
        $this->assertSame(7, Vote::whereNotNull('seq')->count());
        $this->assertTrue($ledger->verify($election)['ok']);
    }

    public function test_penutupan_menyimpan_hak_masuk_belum_terpakai_dan_buka_kembali_melanjutkan(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);

        $this->actingAs($this->admin());
        $res = $this->postJson("/api/v1/panitia/election/status", ["status" => "closed", "confirm" => "TUTUP"])->assertOk();
        $res->assertJsonPath("info.unused_checkins", 1)->assertJsonPath("data.booth_waiting", 1);

        // Hak masuk tidak dihapus/dihanguskan; bilik menolak karena pemungutan ditutup.
        $this->assertSame(1, BoothCredit::waiting($election->id)->count());
        $this->boothVote($booth, $election->candidates()->first()->id)->assertStatus(403)->assertJsonPath("code", "voting_closed");
        $r = app(LedgerService::class)->verify($election);
        $this->assertTrue($r["ok"], implode("; ", $r["errors"]));
        $this->assertSame(1, $r["credits_waiting"]);

        // Admin membuka kembali → pemilih yang sudah check-in tetap bisa memilih.
        $this->postJson("/api/v1/panitia/election/status", ["status" => "open", "confirm" => "BUKA"])->assertOk();
        $this->boothVote($booth, $election->candidates()->first()->id)->assertCreated();
        $this->assertSame(0, BoothCredit::waiting($election->id)->count());
    }

    public function test_perubahan_isi_suara_terdeteksi_verifikasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        [$c1, $c2] = $election->candidates()->pluck('id')->all();

        foreach (['0070000001', '0070000002'] as $nisn) {
            Voter::factory()->create(['identifier' => $nisn]);
            $this->checkInByNisn($checkin, $nisn);
            $this->boothVote($booth, $c1)->assertCreated();
        }

        Vote::where('seq', 1)->update(['candidate_id' => $c2]); // manipulasi langsung di DB

        $this->assertFalse(app(LedgerService::class)->verify($election)['ok']);
        $this->artisan('votes:verify-ledger')->assertExitCode(1);
    }

    public function test_suara_siluman_tanpa_checkin_terdeteksi_rekonsiliasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $this->boothVote($booth, $election->candidates()->first()->id)->assertCreated();

        // Seseorang menyisipkan suara langsung ke DB tanpa check-in.
        Vote::create(['election_id' => $election->id, 'candidate_id' => $election->candidates()->first()->id, 'receipt_code' => 'AAAA-BBBB-CC', 'nonce' => 'x']);

        $r = app(LedgerService::class)->verify($election);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('jumlah check-in', implode(' ', $r['errors']));
    }

    public function test_publikasi_ditolak_bila_ledger_rusak(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create(['identifier' => '0070000001'])->identifier);
        $this->boothVote($booth, $election->candidates()->first()->id)->assertCreated();

        $this->actingAs($this->panitia());
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])->assertOk();
        Vote::query()->update(['nonce' => 'dimanipulasi']);
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'published', 'confirm' => 'PUBLIKASI'])->assertStatus(422);
    }
    public function test_banyak_meja_checkin_dan_banyak_bilik_berbagi_satu_antrean(): void
    {
        $election = $this->openElection();
        $cid = $election->candidates()->first()->id;

        $checkins = [];
        for ($i = 1; $i <= 5; $i++) {
            $checkins[] = $this->device("Check-in {$i}")[1];
        }
        $booths = [];
        for ($i = 1; $i <= 10; $i++) {
            $booths[] = $this->booth("Bilik {$i}")[1];
        }

        // 5 pemilih check-in, tersebar di 5 meja berbeda.
        foreach ($checkins as $i => $headers) {
            $this->checkInByNisn($headers, Voter::factory()->create()->identifier);
        }
        $this->assertSame(5, BoothCredit::count());
        $this->getJson("/api/v1/kiosk/booth/status", $booths[0])->assertJson(["waiting" => 5, "holding" => false]);

        // 10 bilik masing-masing mencoba memilih: tepat 5 berhasil, 5 ditolak.
        $ok = 0;
        $rejected = 0;
        foreach ($booths as $headers) {
            $res = $this->boothVote($headers, $cid);
            if ($res->status() === 201) {
                $ok++;
            } else {
                $res->assertStatus(409)->assertJsonPath("code", "no_checkin");
                $rejected++;
            }
        }

        $this->assertSame(5, $ok);
        $this->assertSame(5, $rejected);
        $this->assertSame(5, Vote::count());
        $this->assertSame(0, BoothCredit::count());
        $r = app(LedgerService::class)->verify($election);
        $this->assertTrue($r["ok"], implode("; ", $r["errors"]));
    }
}