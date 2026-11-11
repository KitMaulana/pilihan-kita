<?php

namespace Tests\Feature;

use App\Models\BoothCredit;
use App\Models\Vote;
use App\Models\Voter;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/** Bilik memesan hak masuk: surat suara hanya menyala di bilik sebanyak pemilih yang sudah check-in. */
class BoothClaimTest extends TestCase
{
    use RefreshDatabase;

    private function claim(array $booth)
    {
        return $this->postJson('/api/v1/kiosk/booth/claim', [], $booth);
    }

    private function checkIns(array $checkin, int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        }
    }

    public function test_hanya_sebanyak_checkin_bilik_yang_menyala(): void
    {
        $this->openElection();
        [, $checkin] = $this->device();
        $booths = [];
        for ($i = 1; $i <= 5; $i++) {
            $booths[] = $this->booth("Bilik {$i}")[1];
        }

        // Belum ada check-in → semua bilik di layar tunggu.
        foreach ($booths as $b) {
            $this->claim($b)->assertJson(['ready' => false]);
        }

        // 2 check-in, 5 bilik: tepat 2 bilik yang menyala.
        $this->checkIns($checkin, 2);
        $lit = collect($booths)->filter(fn ($b) => $this->claim($b)->json('ready'))->count();
        $this->assertSame(2, $lit);
        $this->claim($booths[4])->assertJson(['in_booths' => 2, 'waiting' => 0]);
    }

    public function test_pesanan_idempotent_satu_bilik_satu_hak_masuk(): void
    {
        $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkIns($checkin, 3);

        foreach (range(1, 4) as $_) {
            $this->claim($booth)->assertJson(['holding' => true, 'in_booths' => 1, 'waiting' => 2]);
        }
        $this->assertSame(1, BoothCredit::claimed(1)->count());
    }

    public function test_bilik_yang_selesai_memilih_tidak_menyala_lagi_bila_sisanya_sudah_dipesan(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $a] = $this->booth('A');
        [, $b] = $this->booth('B');
        [, $c] = $this->booth('C');
        $cid = $election->candidates()->first()->id;

        // 5 check-in, bilik A, B, C masing-masing memesan; A & B memilih.
        $this->checkIns($checkin, 3);
        foreach ([$a, $b, $c] as $x) {
            $this->claim($x)->assertJson(['ready' => true]);
        }
        $this->boothVote($a, $cid)->assertCreated();
        $this->boothVote($b, $cid)->assertCreated();

        // Sisa 1 hak masuk, dipegang C. A dan B kembali ke layar tunggu (tidak menyala lagi).
        $this->claim($a)->assertJson(['ready' => false, 'in_booths' => 1]);
        $this->claim($b)->assertJson(['ready' => false]);
        $this->getJson('/api/v1/kiosk/booth/status', $c)->assertJson(['holding' => true]);

        $this->boothVote($c, $cid)->assertCreated();
        $this->assertSame(0, BoothCredit::count());
        $this->claim($c)->assertJson(['ready' => false, 'in_booths' => 0]);
        $this->assertTrue(app(LedgerService::class)->verify($election)['ok']);
    }

    public function test_suara_memakai_hak_masuk_milik_bilik_sendiri_bukan_milik_bilik_lain(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $a] = $this->booth('A');
        [, $b] = $this->booth('B');
        $cid = $election->candidates()->first()->id;

        $this->checkIns($checkin, 1);
        $this->claim($a)->assertJson(['ready' => true]); // A memegang satu-satunya hak masuk

        // B tidak memegang apa pun dan tidak ada yang antre → ditolak; hak masuk A tidak boleh dicuri.
        $this->boothVote($b, $cid)->assertStatus(409)->assertJsonPath('code', 'no_checkin');
        $this->assertSame(1, BoothCredit::count());
        $this->boothVote($a, $cid)->assertCreated();
    }

    public function test_bilik_mati_melepas_pesanan_dan_bilik_lain_bisa_memakainya(): void
    {
        $election = $this->openElection();
        $election->update(['closes_at' => now()->addDay()]);
        [, $checkin] = $this->device();
        [, $a] = $this->booth('A');
        [, $b] = $this->booth('B');
        $this->checkIns($checkin, 1);

        $this->claim($a)->assertJson(['ready' => true]);
        $this->claim($b)->assertJson(['ready' => false]); // A masih memegang

        // A mati > 2 menit (tidak ada detak); B kemudian menyala dengan hak masuk yang sama.
        $this->travel(3)->minutes();
        $this->claim($b)->assertJson(['ready' => true, 'in_booths' => 1]);
        $this->assertSame(1, BoothCredit::count(), 'Hak masuk tidak hilang, hanya pindah bilik.');
        $this->assertTrue(app(LedgerService::class)->verify($election)['ok']);
    }

    public function test_bilik_yang_aktif_tidak_dilepas_pesanannya(): void
    {
        $this->openElection();
        [, $checkin] = $this->device();
        [, $a] = $this->booth('A');
        [, $b] = $this->booth('B');
        $this->checkIns($checkin, 1);
        $this->claim($a)->assertJson(['ready' => true]);

        // A terus mengirim detak tiap < 2 menit selama pemilih berada di bilik (di sini 90 detik demi 90 detik).
        for ($i = 0; $i < 4; $i++) {
            $this->travel(90)->seconds();
            $this->getJson('/api/v1/kiosk/booth/status', $a)->assertJson(['holding' => true]);
            $this->claim($b)->assertJson(['ready' => false]);
        }
    }

    public function test_meja_checkin_tidak_bisa_memesan_dan_pesanan_tidak_memuat_identitas(): void
    {
        $this->openElection();
        [, $checkin] = $this->device();
        $this->checkIns($checkin, 1);

        $this->postJson('/api/v1/kiosk/booth/claim', [], $checkin)->assertStatus(403)->assertJsonPath('code', 'wrong_device_role');

        $columns = Schema::getColumnListing('booth_credits');
        foreach (['voter_id', 'created_at', 'ticket_id', 'check_in_device_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }
        // Satu-satunya penunjuk perangkat adalah bilik pemegang (bukan meja check-in yang tahu identitas).
        $this->assertContains('claimed_by', $columns);
    }

    public function test_reset_suara_dan_tutup_tidak_merusak_rekonsiliasi_pesanan(): void
    {
        $election = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkIns($checkin, 2);
        $this->claim($booth)->assertJson(['ready' => true]);

        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election/reset-votes', ['confirm' => 'RESET SUARA'])->assertOk();
        $this->assertSame(0, BoothCredit::count());
        $this->assertSame(0, Vote::count());
        $this->assertTrue(app(LedgerService::class)->verify($election->fresh())['ok']);
    }
}
