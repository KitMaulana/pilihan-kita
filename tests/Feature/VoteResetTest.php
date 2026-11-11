<?php

namespace Tests\Feature;

use App\Models\Election;
use App\Models\Vote;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class VoteResetTest extends TestCase
{
    use RefreshDatabase;

    private array $boothHeaders = [];

    /** Check-in dengan wajah di meja check-in → memilih di bilik. */
    private function voteOnce(array $h, int $axis, int $candidateId): void
    {
        $this->boothHeaders = $this->boothHeaders ?: $this->booth()[1];
        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec($axis)), $h)->assertOk()->json('ticket');
        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)->assertOk()->assertJsonPath('checked_in', true);
        $this->boothVote($this->boothHeaders, $candidateId)->assertCreated();
    }

    public function test_admin_reset_semua_suara_lalu_pemilih_bisa_memilih_lagi(): void
    {
        $election = $this->openElection(['seal_batch_size' => 1]);
        [, $h] = $this->device();
        $a = $this->voterWithFace(1);
        $b = $this->voterWithFace(2);
        $c1 = $election->candidates()->first()->id;

        $this->voteOnce($h, 1, $c1);
        $this->voteOnce($h, 2, $c1);
        $this->assertSame(2, Vote::count());
        $this->assertNotNull($election->fresh()->ledger_head_hash);

        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'RESET SUARA'])
            ->assertOk()
            ->assertJsonPath('reset.votes', 2)
            ->assertJsonPath('reset.voters', 2)
            ->assertJsonPath('data.votes_count', 0)
            ->assertJsonPath('data.status', Election::OPEN);

        $this->assertSame(0, Vote::count());
        $this->assertDatabaseCount('voter_turnouts', 0);
        $this->assertFalse($a->fresh()->has_voted);
        $this->assertFalse($b->fresh()->has_voted);
        $this->assertSame(0, $election->fresh()->ledger_count);
        $this->assertDatabaseHas('activity_logs', ['action' => 'votes.reset_all']);

        // Hasil publik langsung nol (cache dibuang).
        $this->getJson('/api/v1/public/results')->assertJsonPath('candidates.0.votes', 0);

        // Pemilih A bisa memilih lagi dan ledger baru tetap valid.
        $this->voteOnce($h, 1, $c1);
        $this->assertTrue(app(LedgerService::class)->verify($election->fresh())['ok']);
    }

    public function test_reset_butuh_konfirmasi_dan_hanya_admin(): void
    {
        $this->openElection();

        $this->actingAs($this->panitia());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'RESET SUARA'])->assertForbidden();

        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'reset'])
            ->assertStatus(422)->assertJsonPath('errors.confirm.0', 'Ketik "RESET SUARA" untuk mengonfirmasi.');
    }

    public function test_reset_ditolak_setelah_hasil_dipublikasikan(): void
    {
        $election = $this->openElection();
        $election->update(['status' => Election::PUBLISHED]);

        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'RESET SUARA'])
            ->assertStatus(422)->assertJsonValidationErrors('election');
    }

    public function test_opsi_hapus_log_percobaan_membuka_kunci_pemilih(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $voter = $this->voterWithFace(1, ['identifier' => '0070000001', 'birth_date' => '2008-01-01']);
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0070000001', 'birth_date' => '2009-09-09'], $h);
        }
        $this->assertNotNull($voter->fresh()->locked_at);

        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'RESET SUARA', 'clear_attempts' => true])
            ->assertOk()->assertJsonPath('reset.attempts', 3);

        $this->assertNull($voter->fresh()->locked_at);
        $this->assertSame(0, (int) $voter->fresh()->failed_attempts);
        $this->assertDatabaseCount('access_attempts', 0);
    }
}
