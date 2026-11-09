<?php

namespace Tests\Feature;

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

class VotingTest extends TestCase
{
    use RefreshDatabase;

    /** Alur penuh sampai token suara; mengembalikan [voteToken, headers, election, voter]. */
    private function readyToVote(array $settings = []): array
    {
        $election = $this->openElection($settings);
        [, $h] = $this->device();
        $voter = $this->voterWithFace(1);
        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->assertOk()->json('ticket');
        $token = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)
            ->assertOk()->json('vote_token');

        return [$token, $h, $election, $voter];
    }

    public function test_alur_lengkap_menghasilkan_resi_dan_menandai_sudah_memilih(): void
    {
        [$token, $h, $election, $voter] = $this->readyToVote();
        $candidate = $election->candidates()->first();

        $res = $this->postJson('/api/v1/kiosk/vote', [
            'vote_token' => $token, 'candidate_id' => $candidate->id, 'idempotency_key' => (string) Str::uuid(),
        ], $h)->assertCreated();

        $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/', $res->json('receipt_code'));
        $this->assertTrue($voter->fresh()->has_voted);
        $this->assertDatabaseHas('voter_turnouts', ['election_id' => $election->id, 'voter_id' => $voter->id]);
        $this->assertSame(1, Vote::count());
        $this->assertDatabaseCount('ballot_tickets', 0);
    }

    public function test_token_suara_sekali_pakai(): void
    {
        [$token, $h, $election] = $this->readyToVote();
        $cid = $election->candidates()->first()->id;

        $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $cid, 'idempotency_key' => (string) Str::uuid()], $h)->assertCreated();
        $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $cid, 'idempotency_key' => (string) Str::uuid()], $h)->assertStatus(410);

        $this->assertSame(1, Vote::count());
    }

    public function test_pengiriman_ulang_dengan_idempotency_key_sama_mengembalikan_resi_sama(): void
    {
        [$token, $h, $election] = $this->readyToVote();
        $payload = ['vote_token' => $token, 'candidate_id' => $election->candidates()->first()->id, 'idempotency_key' => (string) Str::uuid()];

        $first = $this->postJson('/api/v1/kiosk/vote', $payload, $h)->assertCreated()->json('receipt_code');
        $second = $this->postJson('/api/v1/kiosk/vote', $payload, $h)->assertOk()->assertJsonPath('replayed', true)->json('receipt_code');

        $this->assertSame($first, $second);
        $this->assertSame(1, Vote::count());
    }

    public function test_constraint_database_menjamin_satu_orang_satu_suara(): void
    {
        // Simulasi balapan: transaksi lain sudah menyisipkan penanda tepat sebelum kita.
        [$token, $h, $election, $voter] = $this->readyToVote();

        $this->expectsDatabaseUniqueGuard($election->id, $voter->id);

        DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);
        $this->postJson('/api/v1/kiosk/vote', [
            'vote_token' => $token, 'candidate_id' => $election->candidates()->first()->id, 'idempotency_key' => (string) Str::uuid(),
        ], $h)->assertStatus(409)->assertJsonPath('code', 'already_voted');

        $this->assertSame(0, Vote::count());
    }

    private function expectsDatabaseUniqueGuard(int $electionId, int $voterId): void
    {
        DB::table('voter_turnouts')->insert(['election_id' => $electionId, 'voter_id' => $voterId]);
        try {
            DB::table('voter_turnouts')->insert(['election_id' => $electionId, 'voter_id' => $voterId]);
            $this->fail('Primary key voter_turnouts seharusnya menolak duplikat.');
        } catch (QueryException) {
            // sesuai harapan
        }
        DB::table('voter_turnouts')->where(['election_id' => $electionId, 'voter_id' => $voterId])->delete();
    }

    public function test_kandidat_dari_pemilihan_lain_ditolak(): void
    {
        // Pemilihan lama (dibuat lebih dulu → bukan "current").
        $other = Election::create(['name' => 'Lama', 'status' => Election::PUBLISHED]);
        $foreign = Candidate::create(['election_id' => $other->id, 'number' => 1, 'name' => 'X']);
        [$token, $h] = $this->readyToVote();

        $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $foreign->id, 'idempotency_key' => (string) Str::uuid()], $h)
            ->assertStatus(422)->assertJsonPath('code', 'invalid_candidate');
    }

    public function test_tabel_votes_tidak_bisa_dikaitkan_ke_pemilih(): void
    {
        $columns = Schema::getColumnListing('votes');
        foreach (['voter_id', 'nisn', 'nip', 'identifier', 'created_at', 'updated_at', 'device_id', 'user_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns, "Kolom {$forbidden} tidak boleh ada di votes");
        }
        $this->assertNotContains('updated_at', Schema::getColumnListing('voters'));
        $this->assertNotContains('created_at', Schema::getColumnListing('voter_turnouts'));
        $this->assertNotContains('id', Schema::getColumnListing('voter_turnouts')); // tanpa auto-increment

        [$token, $h, $election] = $this->readyToVote();
        $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $election->candidates()->first()->id, 'idempotency_key' => (string) Str::uuid()], $h);

        $vote = Vote::first();
        $this->assertTrue(Str::isUuid($vote->id));
        $this->assertSame('4', $vote->id[14], 'ID suara harus UUIDv4 (acak), bukan v7 (memuat waktu)');
    }

    public function test_ledger_disegel_per_batch_dan_terverifikasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 3]);
        [, $h] = $this->device();
        $cids = $election->candidates()->pluck('id')->all();

        for ($i = 0; $i < 7; $i++) {
            $voter = Voter::factory()->create(['identifier' => '00700000'.str_pad((string) $i, 2, '0', STR_PAD_LEFT)]);
            $ticket = $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => $voter->identifier, 'birth_date' => '2008-05-17'], $h)->assertOk()->json('ticket');
            $token = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)->json('vote_token');
            $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $cids[$i % 2], 'idempotency_key' => (string) Str::uuid()], $h)->assertCreated();
        }

        // 7 suara, batch 3 → 6 tersegel, 1 menunggu.
        $this->assertSame(6, Vote::whereNotNull('seq')->count());
        $ledger = app(LedgerService::class);
        $r = $ledger->verify($election);
        $this->assertTrue($r['ok'], implode('; ', $r['errors']));
        $this->assertSame(1, $r['pending']);

        $this->artisan('votes:verify-ledger')->assertExitCode(0);

        // Penutupan menyegel sisa.
        $this->actingAs($this->panitia())->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])->assertOk();
        $this->assertSame(7, Vote::whereNotNull('seq')->count());
        $this->assertTrue($ledger->verify($election)['ok']);
    }

    public function test_perubahan_isi_suara_terdeteksi_verifikasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $h] = $this->device();
        [$c1, $c2] = $election->candidates()->pluck('id')->all();

        foreach (['0070000001', '0070000002'] as $nisn) {
            Voter::factory()->create(['identifier' => $nisn]);
            $ticket = $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => $nisn, 'birth_date' => '2008-05-17'], $h)->json('ticket');
            $token = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)->json('vote_token');
            $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $c1, 'idempotency_key' => (string) Str::uuid()], $h);
        }

        Vote::where('seq', 1)->update(['candidate_id' => $c2]); // manipulasi langsung di DB

        $r = app(LedgerService::class)->verify($election);
        $this->assertFalse($r['ok']);
        $this->artisan('votes:verify-ledger')->assertExitCode(1);
    }

    public function test_publikasi_ditolak_bila_ledger_rusak(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $h] = $this->device();
        Voter::factory()->create(['identifier' => '0070000001']);
        $ticket = $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0070000001', 'birth_date' => '2008-05-17'], $h)->json('ticket');
        $token = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)->json('vote_token');
        $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $election->candidates()->first()->id, 'idempotency_key' => (string) Str::uuid()], $h);

        $this->actingAs($this->panitia());
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])->assertOk();
        Vote::query()->update(['nonce' => 'dimanipulasi']);
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'published', 'confirm' => 'PUBLIKASI'])->assertStatus(422);
    }
}
