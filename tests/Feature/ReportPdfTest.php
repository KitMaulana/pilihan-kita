<?php

namespace Tests\Feature;

use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use App\Services\ElectionService;
use App\Services\ReportPdfService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Laporan hasil PDF A4: isi, ukuran halaman, hak akses, dan pembatasan unduhan publik. */
class ReportPdfTest extends TestCase
{
    use RefreshDatabase;

    /** Sesi berpasangan dengan 3 suara (2 untuk kandidat 1, 1 untuk kandidat 2). */
    private function sessionWithVotes(string $status = Election::CLOSED, string $school = 'SMAN 1 Ciruas'): Election
    {
        $e = $this->openElection();
        $e->update(['school_name' => $school]);
        [$c1, $c2] = $e->candidates()->pluck('id')->all();
        foreach ([$c1, $c1, $c2] as $i => $cid) {
            $v = Voter::factory()->create(['election_id' => $e->id, 'name' => "Pemilih Rahasia {$i}"]);
            DB::table('voter_turnouts')->insert(['election_id' => $e->id, 'voter_id' => $v->id]);
            Vote::create(['election_id' => $e->id, 'candidate_id' => $cid, 'receipt_code' => "RS{$e->id}{$i}-AAAA-BB", 'nonce' => "n{$i}"]);
        }
        $svc = app(ElectionService::class);
        if ($status === Election::CLOSED || $status === Election::PUBLISHED) {
            $svc->transition($e, Election::CLOSED);
        }
        if ($status === Election::PUBLISHED) {
            $svc->transition($e->refresh(), Election::PUBLISHED);
        }

        return $e->refresh();
    }

    public function test_panitia_mengunduh_pdf_a4_siap_cetak(): void
    {
        $e = $this->sessionWithVotes();
        $this->actingAs($this->panitia($e));

        $res = $this->get('/api/v1/panitia/election/report/pdf')->assertOk();
        $res->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment; filename="Laporan-Hasil-sman-1-ciruas-', $res->headers->get('Content-Disposition'));
        $body = $res->getContent();
        $this->assertStringStartsWith('%PDF-', $body);
        $this->assertSame((string) strlen($body), $res->headers->get('Content-Length'));
        // Ukuran halaman A4 portrait: 595,28 × 841,89 pt.
        $this->assertMatchesRegularExpression('/MediaBox\s*\[\s*0(\.0+)?\s+0(\.0+)?\s+595\.2\d*\s+841\.8\d*\s*\]/', $body);

        $inline = $this->get('/api/v1/panitia/election/report/pdf?inline=1')->assertOk();
        $this->assertStringStartsWith('inline;', $inline->headers->get('Content-Disposition'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'report.pdf']);
    }

    public function test_isi_laporan_total_per_jabatan_tanpa_identitas_pemilih(): void
    {
        $e = $this->sessionWithVotes();
        $html = app(ReportPdfService::class)->html($e);

        $this->assertStringContainsString('SMAN 1 Ciruas', $html);
        $this->assertStringContainsString('Total suara', $html);
        $this->assertMatchesRegularExpression('/Total suara<\/td>\s*<td class="num">3<\/td>\s*<td class="num">100%<\/td>/', $html);
        $this->assertStringContainsString('66,67%', $html); // 2 dari 3 suara
        $this->assertStringContainsString('VALID', $html);
        $this->assertStringContainsString('data:image/png;base64,', $html, 'logo ditanam tanpa permintaan jaringan');
        $this->assertStringNotContainsString('Pemilih Rahasia', $html);
        $this->assertStringNotContainsString('-AAAA-BB', $html, 'kode resi tidak dicantumkan');
    }

    public function test_belum_dipublikasikan_ditandai_sementara_dan_final_memuat_hash_dan_pemenang(): void
    {
        $closed = app(ReportPdfService::class)->html($this->sessionWithVotes(Election::CLOSED));
        $this->assertStringContainsString('HASIL SEMENTARA', $closed);
        $this->assertStringNotContainsString('Perolehan suara terbanyak', $closed);
        $this->assertStringContainsString('Dipublikasikan setelah hasil ditetapkan', $closed);

        $e = $this->sessionWithVotes(Election::PUBLISHED, 'SMAN 2 Serang');
        $final = app(ReportPdfService::class)->html($e);
        $this->assertStringNotContainsString('HASIL SEMENTARA', $final);
        $this->assertStringContainsString('Laporan Hasil Akhir Pemilihan', $final);
        $this->assertStringContainsString('Perolehan suara terbanyak', $final);
        $this->assertStringContainsString($e->ledger_head_hash, $final);
    }

    public function test_skema_terpisah_dua_tabel_dengan_total_masing_masing(): void
    {
        $e = Election::create(['name' => 'P', 'school_name' => 'SMA Terpisah', 'status' => Election::OPEN,
            'opens_at' => now()->subHour(), 'closes_at' => now()->addHour(),
            'settings' => ['ballot_mode' => Election::MODE_SEPARATE] + Election::DEFAULT_SETTINGS]);
        $k = $e->candidates()->create(['position' => 'ketua', 'number' => 1, 'name' => 'Ketua Satu']);
        $w = $e->candidates()->create(['position' => 'wakil', 'number' => 1, 'name' => 'Wakil Satu']);
        $v = Voter::factory()->create(['election_id' => $e->id]);
        DB::table('voter_turnouts')->insert(['election_id' => $e->id, 'voter_id' => $v->id]);
        Vote::create(['election_id' => $e->id, 'candidate_id' => $k->id, 'position' => 'ketua', 'receipt_code' => 'ABCD-EFGH-IJ', 'nonce' => 'a']);
        Vote::create(['election_id' => $e->id, 'candidate_id' => $w->id, 'position' => 'wakil', 'receipt_code' => 'ABCD-EFGH-IJ', 'nonce' => 'b']);

        $html = app(ReportPdfService::class)->html($e);
        $this->assertStringContainsString('Total suara Ketua OSIS', $html);
        $this->assertStringContainsString('Total suara Wakil Ketua OSIS', $html);
        $this->assertStringContainsString('setiap surat suara berisi pilihan ketua dan wakil', $html);

        $this->actingAs($this->panitia($e));
        $this->get('/api/v1/panitia/election/report/pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_nama_kandidat_di_laporan_di_escape(): void
    {
        $e = $this->sessionWithVotes();
        $e->candidates()->first()->update(['name' => '<script>alert(1)</script> & Co']);

        $html = app(ReportPdfService::class)->html($e->refresh());
        $this->assertStringNotContainsString('<script>alert(1)</script>', $html);
        $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co', $html);
    }

    public function test_hak_akses_unduhan_panitia(): void
    {
        $a = $this->sessionWithVotes(Election::CLOSED, 'SMAN 1 Ciruas');
        $b = Election::create(['name' => 'P', 'school_name' => 'SMA Lain', 'status' => Election::OPEN, 'settings' => Election::DEFAULT_SETTINGS]);

        $this->get('/api/v1/panitia/election/report/pdf', ['Accept' => 'application/json'])->assertUnauthorized();

        $this->actingAs($this->panitia($a));
        $this->get('/api/v1/panitia/election/report/pdf', ['X-Session-Id' => $b->id, 'Accept' => 'application/json'])->assertForbidden();
        $this->get('/api/v1/panitia/election/report/pdf')->assertOk();

        // Admin boleh memilih sekolah mana pun lewat header sesi.
        $this->actingAs($this->admin());
        $this->get('/api/v1/panitia/election/report/pdf', ['X-Session-Id' => $b->id])->assertOk();
    }

    public function test_pdf_publik_hanya_setelah_dipublikasikan(): void
    {
        $closed = $this->sessionWithVotes(Election::CLOSED, 'SMAN 1 Ciruas');
        $this->get("/api/v1/public/results/pdf?session={$closed->slug}", ['Accept' => 'application/json'])->assertNotFound();
        $this->get('/api/v1/public/results/pdf?session=tidak-ada', ['Accept' => 'application/json'])->assertNotFound();
        $this->get('/api/v1/public/results/pdf', ['Accept' => 'application/json'])->assertNotFound();

        $pub = $this->sessionWithVotes(Election::PUBLISHED, 'SMAN 2 Serang');
        Cache::flush();
        $res = $this->get("/api/v1/public/results/pdf?session={$pub->slug}")->assertOk();
        $res->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $res->getContent());
        $this->assertStringContainsString('attachment; filename="Laporan-Hasil-sman-2-serang-', $res->headers->get('Content-Disposition'));
        $this->assertStringContainsString('public', $res->headers->get('Cache-Control'));
    }

    public function test_hasil_publik_memberi_tahu_klien_bahwa_hasil_sudah_final(): void
    {
        $pub = $this->sessionWithVotes(Election::PUBLISHED, 'SMAN 2 Serang');
        Cache::flush();
        $this->getJson("/api/v1/public/results?session={$pub->slug}")->assertJsonPath('is_final', true)->assertJsonPath('election.slug', $pub->slug);
    }
}
