<?php

namespace Tests\Feature;

use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicResultsTest extends TestCase
{
    use RefreshDatabase;

    private function castVotes(Election $election, array $headers, int $n, int $candidateIndex = 0): array
    {
        $receipts = [];
        $cid = $election->candidates()->get()[$candidateIndex]->id;
        for ($i = 0; $i < $n; $i++) {
            $voter = Voter::factory()->create();
            $ticket = $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => $voter->identifier, 'birth_date' => '2008-05-17'], $headers)->json('ticket');
            $token = $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $headers)->json('vote_token');
            $receipts[] = $this->postJson('/api/v1/kiosk/vote', ['vote_token' => $token, 'candidate_id' => $cid, 'idempotency_key' => (string) Str::uuid()], $headers)->json('receipt_code');
        }

        return $receipts;
    }

    public function test_hasil_berisi_agregat_dan_partisipasi_tanpa_rincian_kelas(): void
    {
        $election = $this->openElection(['seal_batch_size' => 2]);
        [, $h] = $this->device();
        Voter::factory()->count(3)->create();
        Voter::factory()->teacher('198001012005011001')->create();
        $this->castVotes($election, $h, 2);

        $res = $this->getJson('/api/v1/public/results')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=5, public')
            ->assertJsonPath('candidates.0.votes', 2)
            ->assertJsonPath('participation.students.voted', 2)
            ->assertJsonPath('participation.students.total', 5)
            ->assertJsonPath('participation.teachers.total', 1)
            ->assertJsonPath('ledger.head_hash', null); // hash terakhir baru dipublikasikan saat published

        $body = $res->getContent();
        foreach (['class_name":"XI', 'identifier', 'birth_date', 'nisn', 'voter_id'] as $leak) {
            $this->assertStringNotContainsString($leak, $body);
        }
    }

    public function test_selama_voting_hanya_suara_tersegel_yang_dihitung(): void
    {
        $election = $this->openElection(['seal_batch_size' => 3]);
        [, $h] = $this->device();
        $this->castVotes($election, $h, 2);

        Cache::flush();
        $this->getJson('/api/v1/public/results')
            ->assertJsonPath('votes_counted', 0)
            ->assertJsonPath('votes_pending', 2)
            ->assertJsonPath('participation.all.voted', 2);

        $this->castVotes($election, $h, 1); // genap satu batch → disegel
        Cache::flush();
        $this->getJson('/api/v1/public/results')->assertJsonPath('votes_counted', 3)->assertJsonPath('votes_pending', 0);
    }

    public function test_hasil_di_cache_lima_detik(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $h] = $this->device();
        $this->getJson('/api/v1/public/results')->assertJsonPath('votes_counted', 0);

        $this->castVotes($election, $h, 1);
        $this->getJson('/api/v1/public/results')->assertJsonPath('votes_counted', 0); // masih snapshot lama

        $this->travel(6)->seconds();
        $this->getJson('/api/v1/public/results')->assertJsonPath('votes_counted', 1);
    }

    public function test_hasil_akhir_menampilkan_hash_terakhir_setelah_publikasi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 5]);
        [, $h] = $this->device();
        $this->castVotes($election, $h, 2);

        $this->actingAs($this->panitia());
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])->assertOk();
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'published', 'confirm' => 'PUBLIKASI'])->assertOk();

        $res = $this->getJson('/api/v1/public/results')->assertJsonPath('is_final', true)->assertJsonPath('votes_counted', 2);
        $this->assertSame($election->fresh()->ledger_head_hash, $res->json('ledger.head_hash'));
        $this->assertSame(64, strlen($res->json('ledger.head_hash')));
    }

    public function test_cek_resi_hanya_menjawab_tercatat_tanpa_pilihan(): void
    {
        $election = $this->openElection();
        [, $h] = $this->device();
        [$receipt] = $this->castVotes($election, $h, 1);

        $res = $this->postJson('/api/v1/public/receipt', ['code' => strtolower(str_replace('-', '', $receipt))])
            ->assertOk()->assertJsonPath('recorded', true);
        $body = $res->getContent();
        $this->assertStringNotContainsString('candidate', $body);
        $this->assertStringNotContainsString('Kandidat', $body);

        $this->postJson('/api/v1/public/receipt', ['code' => 'ZZZZ-ZZZZ-ZZ'])->assertJsonPath('recorded', false);
        $this->postJson('/api/v1/public/receipt', ['code' => 'abc'])->assertStatus(422);
    }

    public function test_status_hanya_bisa_diubah_dengan_konfirmasi_ganda(): void
    {
        $election = Election::create(['name' => 'X', 'status' => Election::DRAFT]);
        $this->actingAs($this->panitia());

        // Tanpa kandidat → tidak bisa dibuka.
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'open', 'confirm' => 'BUKA'])->assertStatus(422);

        $election->candidates()->create(['number' => 1, 'name' => 'A']);
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'open', 'confirm' => 'buka saja'])->assertStatus(422)->assertJsonValidationErrors('confirm');
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'open', 'confirm' => 'buka'])->assertOk()->assertJsonPath('data.status', 'open');
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'published', 'confirm' => 'PUBLIKASI'])->assertStatus(422); // harus tutup dulu

        $this->assertDatabaseHas('activity_logs', ['action' => 'election.status']);
        $this->assertSame(0, Vote::count());
    }
}
