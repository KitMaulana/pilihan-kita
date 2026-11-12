<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/** Skema surat suara per sekolah: berpasangan (1 pilihan) vs ketua & wakil dipilih terpisah (2 pilihan). */
class BallotModeTest extends TestCase
{
    use RefreshDatabase;

    /** Sesi terbuka skema terpisah: 2 calon ketua + 2 calon wakil. */
    private function separateElection(): array
    {
        $e = Election::create([
            'name' => 'Pemilihan OSIS', 'school_name' => 'SMA Terpisah', 'status' => Election::OPEN,
            'opens_at' => now()->subHour(), 'closes_at' => now()->addHour(),
            'settings' => ['ballot_mode' => Election::MODE_SEPARATE] + Election::DEFAULT_SETTINGS,
        ]);
        $k1 = $e->candidates()->create(['position' => 'ketua', 'number' => 1, 'name' => 'Ketua Satu']);
        $k2 = $e->candidates()->create(['position' => 'ketua', 'number' => 2, 'name' => 'Ketua Dua']);
        $w1 = $e->candidates()->create(['position' => 'wakil', 'number' => 1, 'name' => 'Wakil Satu']);
        $w2 = $e->candidates()->create(['position' => 'wakil', 'number' => 2, 'name' => 'Wakil Dua']);

        return [$e, $k1, $k2, $w1, $w2];
    }

    private function vote(array $booth, array $choices)
    {
        return $this->postJson('/api/v1/kiosk/vote', ['choices' => $choices, 'idempotency_key' => (string) \Illuminate\Support\Str::uuid()], $booth);
    }

    public function test_skema_terpisah_satu_surat_suara_dua_pilihan_satu_resi(): void
    {
        [$e, $k1, $k2, $w1, $w2] = $this->separateElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();

        // Bilik menerima surat suara 2 langkah.
        $this->getJson('/api/v1/kiosk/candidates', $booth)->assertOk()
            ->assertJsonPath('ballot_mode', 'separate')
            ->assertJsonPath('positions.0.key', 'ketua')->assertJsonPath('positions.1.key', 'wakil')
            ->assertJsonCount(4, 'data');

        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $receipt = $this->vote($booth, ['ketua' => $k1->id, 'wakil' => $w2->id])->assertCreated()->json('receipt_code');

        // Dua baris suara, resi sama, satu hak masuk terpakai.
        $rows = Vote::where('receipt_code', $receipt)->get();
        $this->assertSame(['ketua', 'wakil'], $rows->pluck('position')->sort()->values()->all());
        $this->assertSame(0, \App\Models\BoothCredit::count());
        $this->postJson('/api/v1/public/receipt', ['code' => $receipt])->assertJsonPath('recorded', true);

        // Hasil per jabatan, persentase di dalam jabatannya, total = jumlah surat suara (bukan baris).
        Cache::flush();
        $res = $this->getJson("/api/v1/public/results?session={$e->slug}")->assertOk()
            ->assertJsonPath('ballot_mode', 'separate')
            ->assertJsonPath('votes_counted', 1)
            ->assertJsonPath('positions.0.label', 'Ketua OSIS')
            ->assertJsonPath('positions.0.votes_counted', 1)
            ->assertJsonPath('positions.1.label', 'Wakil Ketua OSIS');
        $ketua = collect($res->json('positions.0.candidates'))->keyBy('name');
        $wakil = collect($res->json('positions.1.candidates'))->keyBy('name');
        $this->assertEquals(100, $ketua['Ketua Satu']['percent']);
        $this->assertSame(0, $ketua['Ketua Dua']['votes']);
        $this->assertEquals(100, $wakil['Wakil Dua']['percent']);

        $r = app(LedgerService::class)->verify($e);
        $this->assertTrue($r['ok'], implode('; ', $r['errors']));
        $this->assertSame(1, $r['ballots']);
        $this->assertSame(['ketua' => 1, 'wakil' => 1], $r['by_position']);
    }

    public function test_skema_terpisah_menolak_surat_suara_tidak_lengkap_atau_jabatan_tertukar(): void
    {
        [, $k1, , $w1] = $this->separateElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);

        $this->vote($booth, ['ketua' => $k1->id])->assertStatus(422)->assertJsonPath('code', 'incomplete_ballot');
        $this->vote($booth, ['ketua' => $w1->id, 'wakil' => $w1->id])->assertStatus(422)->assertJsonPath('code', 'invalid_candidate'); // calon wakil sebagai ketua
        $this->vote($booth, ['ketua' => $k1->id, 'wakil' => $k1->id])->assertStatus(422)->assertJsonPath('code', 'invalid_candidate'); // calon ketua sebagai wakil
        $this->postJson('/api/v1/kiosk/vote', ['candidate_id' => $k1->id, 'idempotency_key' => (string) \Illuminate\Support\Str::uuid()], $booth)
            ->assertStatus(422)->assertJsonPath('code', 'incomplete_ballot');

        // Tidak ada yang tercatat sebagian; hak masuk masih utuh untuk percobaan berikutnya.
        $this->assertSame(0, Vote::count());
        $this->assertSame(1, \App\Models\BoothCredit::count());
        $this->vote($booth, ['ketua' => $k1->id, 'wakil' => $w1->id])->assertCreated();
    }

    public function test_skema_berpasangan_tetap_seperti_semula(): void
    {
        $e = $this->openElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $cid = $e->candidates()->first()->id;

        $this->getJson('/api/v1/kiosk/candidates', $booth)->assertJsonPath('ballot_mode', 'pair')->assertJsonPath('positions.0.key', 'pair');
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $this->boothVote($booth, $cid)->assertCreated();
        $this->assertSame('pair', Vote::first()->position);

        // Pilihan "choices.pair" juga diterima; jabatan ketua/wakil ditolak di skema berpasangan.
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $this->vote($booth, ['ketua' => $cid])->assertStatus(422);
        $this->vote($booth, ['pair' => $cid])->assertCreated();
        $this->assertTrue(app(LedgerService::class)->verify($e)['ok']);
    }

    public function test_kandidat_harus_sesuai_skema_dan_nomor_unik_per_jabatan(): void
    {
        $e = Election::create(['name' => 'X', 'school_name' => 'SMA Terpisah', 'status' => Election::DRAFT,
            'settings' => ['ballot_mode' => Election::MODE_SEPARATE] + Election::DEFAULT_SETTINGS]);
        $this->actingAs($this->panitia($e));

        $this->postJson('/api/v1/panitia/candidates', ['number' => 1, 'name' => 'Tanpa Jabatan'])->assertStatus(422)->assertJsonValidationErrors('position');
        $this->postJson('/api/v1/panitia/candidates', ['number' => 1, 'name' => 'Ketua 1', 'position' => 'ketua'])->assertCreated()->assertJsonPath('data.position', 'ketua');
        $this->postJson('/api/v1/panitia/candidates', ['number' => 1, 'name' => 'Wakil 1', 'position' => 'wakil'])->assertCreated(); // No. 1 boleh di tiap jabatan
        $this->postJson('/api/v1/panitia/candidates', ['number' => 1, 'name' => 'Ketua Dobel', 'position' => 'ketua'])
            ->assertStatus(422)->assertJsonPath('errors.number.0', 'Nomor urut 1 untuk Ketua OSIS sudah dipakai.');
        $this->postJson('/api/v1/panitia/candidates', ['number' => 2, 'name' => 'Pasangan', 'position' => 'pair'])->assertStatus(422)->assertJsonValidationErrors('position');
    }

    public function test_buka_pemilihan_butuh_calon_di_setiap_jabatan(): void
    {
        $e = Election::create(['name' => 'X', 'school_name' => 'SMA Terpisah', 'status' => Election::DRAFT,
            'settings' => ['ballot_mode' => Election::MODE_SEPARATE] + Election::DEFAULT_SETTINGS]);
        $e->candidates()->create(['position' => 'ketua', 'number' => 1, 'name' => 'Ketua 1']);
        $this->actingAs($this->panitia($e));

        $this->postJson('/api/v1/panitia/election/status', ['status' => 'open', 'confirm' => 'BUKA'])
            ->assertStatus(422)->assertJsonPath('errors.status.0', 'Tambahkan minimal satu calon Wakil Ketua OSIS aktif sebelum membuka pemilihan.');

        $e->candidates()->create(['position' => 'wakil', 'number' => 1, 'name' => 'Wakil 1']);
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'open', 'confirm' => 'BUKA'])->assertOk();
    }

    public function test_ganti_skema_hanya_saat_draf_dan_kandidat_cocok(): void
    {
        $e = $this->schoolSession('SMA Uji');
        $this->actingAs($this->admin());
        $h = ['X-Session-Id' => $e->id];

        // Draf tanpa kandidat → boleh ganti.
        $this->putJson('/api/v1/panitia/election', ['settings' => ['ballot_mode' => 'separate']], $h)->assertOk()->assertJsonPath('data.settings.ballot_mode', 'separate');

        // Ada kandidat skema terpisah → tidak bisa kembali ke berpasangan sebelum dihapus.
        $e->candidates()->create(['position' => 'ketua', 'number' => 1, 'name' => 'Ketua 1']);
        $this->putJson('/api/v1/panitia/election', ['settings' => ['ballot_mode' => 'pair']], $h)->assertStatus(422)->assertJsonValidationErrors('settings.ballot_mode');

        // Setelah dibuka, admin pun tidak bisa mengganti skema.
        Candidate::query()->delete();
        $e->update(['status' => Election::OPEN]);
        $this->putJson('/api/v1/panitia/election', ['settings' => ['ballot_mode' => 'pair']], $h)
            ->assertStatus(422)->assertJsonValidationErrors(['settings.ballot_mode' => 'Skema pemilihan hanya bisa diubah saat pemilihan masih draf.']);
    }

    public function test_sesi_baru_bisa_langsung_memilih_skema(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election', ['school_name' => 'SMA Terpisah', 'name' => 'Pemilihan', 'ballot_mode' => 'separate'])
            ->assertCreated()->assertJsonPath('data.settings.ballot_mode', 'separate');
        $this->postJson('/api/v1/panitia/election', ['school_name' => 'SMA Pasangan', 'name' => 'Pemilihan'])
            ->assertCreated()->assertJsonPath('data.settings.ballot_mode', 'pair');
    }

    public function test_rekonsiliasi_mendeteksi_surat_suara_terpisah_yang_tidak_lengkap(): void
    {
        [$e, $k1, , $w1] = $this->separateElection();
        [, $checkin] = $this->device();
        [, $booth] = $this->booth();
        $this->checkInByNisn($checkin, Voter::factory()->create()->identifier);
        $receipt = $this->vote($booth, ['ketua' => $k1->id, 'wakil' => $w1->id])->assertCreated()->json('receipt_code');

        // Seseorang menghapus baris "wakil" langsung di DB.
        Vote::where('receipt_code', $receipt)->where('position', 'wakil')->delete();

        $r = app(LedgerService::class)->verify($e);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('Wakil Ketua OSIS', implode(' ', $r['errors']));
    }
}
