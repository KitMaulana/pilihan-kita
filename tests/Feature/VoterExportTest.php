<?php

namespace Tests\Feature;

use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/** Unduh data pemilih sebagai CSV: format impor, laporan lengkap, filter, dan keamanan. */
class VoterExportTest extends TestCase
{
    use RefreshDatabase;

    private Election $school;

    protected function setUp(): void
    {
        parent::setUp();
        $this->school = $this->schoolSession('SMAN 1 Ciruas');
        Voter::factory()->create(['election_id' => $this->school->id, 'identifier' => '0071000001', 'name' => 'Ahmad Fauzi', 'class_name' => 'XI IPA 1', 'birth_date' => '2008-03-14']);
        Voter::factory()->create(['election_id' => $this->school->id, 'identifier' => '0071000002', 'name' => 'Siti Aminah', 'class_name' => 'X-3', 'birth_date' => '2009-07-21']);
        Voter::factory()->teacher('198001012005011001')->create(['election_id' => $this->school->id, 'name' => 'Drs. Budi Santoso', 'class_name' => null, 'birth_date' => '1980-01-01']);
        Voter::factory()->teacher(null)->create(['election_id' => $this->school->id, 'name' => 'Rina Marlina', 'class_name' => null, 'birth_date' => '1990-05-12', 'distinguisher' => 'G-21']);
        $this->actingAs($this->panitia($this->school));
    }

    /** Isi CSV sebagai baris-baris (tanpa BOM). */
    private function rows(string $csv, string $delimiter = ';'): array
    {
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);

        return array_map(fn ($l) => str_getcsv($l, $delimiter, '"', ''), preg_split('/\r\n|\n/', trim($csv)));
    }

    public function test_ekspor_siswa_memakai_format_templat_impor(): void
    {
        $res = $this->get('/api/v1/panitia/voters/export?format=student')->assertOk();
        $res->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename=pemilih-sman-1-ciruas-siswa-', $res->headers->get('Content-Disposition'));
        $this->assertStringStartsWith("\xEF\xBB\xBF", $res->streamedContent(), 'BOM UTF-8 agar Excel membaca huruf dengan benar');

        $rows = $this->rows($res->streamedContent());
        $this->assertSame(['nisn', 'nama', 'kelas', 'tanggal_lahir'], $rows[0]);
        $this->assertCount(3, $rows); // header + 2 siswa (guru tidak ikut)
        $this->assertContains(['0071000001', 'Ahmad Fauzi', 'XI IPA 1', '2008-03-14'], $rows, 'NISN berawalan nol tetap utuh');
        $this->assertContains(['0071000002', 'Siti Aminah', 'X-3', '2009-07-21'], $rows);
    }

    public function test_ekspor_guru_termasuk_guru_tanpa_nip_dan_kode(): void
    {
        $rows = $this->rows($this->get('/api/v1/panitia/voters/export?format=teacher')->assertOk()->streamedContent());

        $this->assertSame(['nip', 'nama', 'tanggal_lahir', 'kode'], $rows[0]);
        $this->assertContains(['198001012005011001', 'Drs. Budi Santoso', '1980-01-01', ''], $rows);
        $this->assertContains(['', 'Rina Marlina', '1990-05-12', 'G-21'], $rows);
        $this->assertCount(3, $rows);
    }

    public function test_hasil_ekspor_bisa_diimpor_ulang_tanpa_galat(): void
    {
        $csv = $this->get('/api/v1/panitia/voters/export?format=student')->streamedContent();
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);

        $res = $this->post('/api/v1/panitia/voters/import/preview', [
            'type' => 'student', 'file' => UploadedFile::fake()->createWithContent('ekspor.csv', $csv),
        ], ['Accept' => 'application/json'])->assertOk();

        $res->assertJsonPath('summary.total', 2)->assertJsonPath('summary.ready', 2)->assertJsonPath('summary.problems', 0)->assertJsonPath('summary.update', 2);

        // Guru juga.
        $tcsv = preg_replace('/^\xEF\xBB\xBF/', '', $this->get('/api/v1/panitia/voters/export?format=teacher&delimiter=comma')->streamedContent());
        $this->post('/api/v1/panitia/voters/import/preview', [
            'type' => 'teacher', 'file' => UploadedFile::fake()->createWithContent('guru.csv', $tcsv),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('summary.problems', 0)->assertJsonPath('summary.ready', 2);
    }

    public function test_pemisah_koma_atau_titik_koma(): void
    {
        $semi = $this->get('/api/v1/panitia/voters/export?format=student')->streamedContent(); // bawaan: titik koma (Excel Indonesia)
        $this->assertStringContainsString('nisn;nama;kelas;tanggal_lahir', $semi);

        $comma = $this->get('/api/v1/panitia/voters/export?format=student&delimiter=comma')->streamedContent();
        $this->assertStringContainsString('nisn,nama,kelas,tanggal_lahir', $comma);
        $this->assertContains(['0071000001', 'Ahmad Fauzi', 'XI IPA 1', '2008-03-14'], $this->rows($comma, ','));
    }

    public function test_ekspor_lengkap_semua_pemilih_dengan_status_tanpa_biometrik(): void
    {
        $voter = Voter::where('identifier', '0071000001')->first();
        FaceTemplate::create(['voter_id' => $voter->id, 'embedding' => FaceTemplate::pack($this->vec(1)), 'model_version' => self::MODEL]);
        Voter::where('identifier', '0071000002')->update(['has_voted' => true]);
        Voter::where('identifier', '198001012005011001')->update(['is_active' => false]);

        $csv = $this->get('/api/v1/panitia/voters/export?format=full')->streamedContent();
        $rows = $this->rows($csv);

        $this->assertSame(['jenis', 'nomor_induk', 'nama', 'kelas', 'kode', 'tanggal_lahir', 'aktif', 'wajah_terdaftar', 'sudah_checkin'], $rows[0]);
        $this->assertCount(5, $rows);
        $this->assertContains(['siswa', '0071000001', 'Ahmad Fauzi', 'XI IPA 1', '', '2008-03-14', 'ya', 'ya', 'belum'], $rows);
        $this->assertContains(['siswa', '0071000002', 'Siti Aminah', 'X-3', '', '2009-07-21', 'ya', 'belum', 'ya'], $rows);
        $this->assertContains(['guru', '198001012005011001', 'Drs. Budi Santoso', '', '', '1980-01-01', 'tidak', 'belum', 'belum'], $rows);
        $this->assertStringNotContainsString('embedding', strtolower($csv));
        $this->assertStringNotContainsString(base64_encode(FaceTemplate::pack($this->vec(1))), $csv);
    }

    public function test_ekspor_mengikuti_filter_aktif(): void
    {
        Voter::where('identifier', '0071000002')->update(['has_voted' => true]);

        $byClass = $this->rows($this->get('/api/v1/panitia/voters/export?format=student&class_name='.urlencode('XI IPA 1'))->streamedContent());
        $this->assertCount(2, $byClass);
        $this->assertSame('Ahmad Fauzi', $byClass[1][1]);

        $voted = $this->rows($this->get('/api/v1/panitia/voters/export?format=student&status=voted')->streamedContent());
        $this->assertCount(2, $voted);
        $this->assertSame('Siti Aminah', $voted[1][1]);

        $search = $this->rows($this->get('/api/v1/panitia/voters/export?format=full&q=Rina')->streamedContent());
        $this->assertCount(2, $search);
        $this->assertSame('Rina Marlina', $search[1][2]);

        // Filter "type" dari daftar tidak boleh membocorkan/menggeser isi ekspor siswa.
        $this->assertCount(3, $this->rows($this->get('/api/v1/panitia/voters/export?format=student&type=teacher')->streamedContent()));
    }

    public function test_hanya_pemilih_sekolah_yang_dipilih_yang_diekspor(): void
    {
        $other = $this->schoolSession('SMA Lain');
        Voter::factory()->create(['election_id' => $other->id, 'identifier' => '0079999999', 'name' => 'Siswa Sekolah Lain']);

        $csv = $this->get('/api/v1/panitia/voters/export?format=full')->streamedContent();
        $this->assertStringNotContainsString('Siswa Sekolah Lain', $csv);

        // Panitia tidak bisa meminta sekolah lain; admin boleh memilih lewat header sesi.
        $this->get('/api/v1/panitia/voters/export?format=full', ['X-Session-Id' => $other->id, 'Accept' => 'application/json'])->assertForbidden();
        $this->actingAs($this->admin());
        $adminCsv = $this->get('/api/v1/panitia/voters/export?format=full', ['X-Session-Id' => $other->id])->streamedContent();
        $this->assertStringContainsString('Siswa Sekolah Lain', $adminCsv);
        $this->assertStringNotContainsString('Ahmad Fauzi', $adminCsv);
    }

    public function test_sel_berawalan_rumus_di_netralkan_dan_nama_berkoma_diberi_kutip(): void
    {
        Voter::factory()->create(['election_id' => $this->school->id, 'identifier' => '0071000009', 'name' => '=HYPERLINK("http://jahat.test","klik")', 'class_name' => '+cmd|calc', 'birth_date' => '2008-01-01']);
        Voter::factory()->create(['election_id' => $this->school->id, 'identifier' => '0071000010', 'name' => 'Budi, S.Pd "Bud"', 'class_name' => 'X-1', 'birth_date' => '2008-01-02']);

        $csv = $this->get('/api/v1/panitia/voters/export?format=student&delimiter=comma')->streamedContent();
        $rows = $this->rows($csv, ',');

        $evil = collect($rows)->firstWhere(0, '0071000009');
        $this->assertStringStartsWith("'=HYPERLINK", $evil[1], 'rumus dinetralkan dengan apostrof');
        $this->assertSame("'+cmd|calc", $evil[2]);
        $tricky = collect($rows)->firstWhere(0, '0071000010');
        $this->assertSame('Budi, S.Pd "Bud"', $tricky[1], 'koma & tanda kutip tetap utuh setelah dibaca ulang');
    }

    public function test_validasi_hak_akses_dan_catatan_audit(): void
    {
        $this->get('/api/v1/panitia/voters/export', ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('format');
        $this->get('/api/v1/panitia/voters/export?format=semua', ['Accept' => 'application/json'])->assertStatus(422);
        $this->get('/api/v1/panitia/voters/export?format=full&delimiter=tab', ['Accept' => 'application/json'])->assertStatus(422);

        $this->get('/api/v1/panitia/voters/export?format=student&class_name=X-3')->assertOk();
        $log = \Illuminate\Support\Facades\DB::table('activity_logs')->where('action', 'voters.exported')->first();
        $this->assertNotNull($log);
        $this->assertSame($this->school->id, (int) $log->election_id);
        $details = json_decode($log->details, true);
        $this->assertSame(['format' => 'student', 'rows' => 1, 'filters' => ['class_name' => 'X-3']], $details);
        $this->assertStringNotContainsString('Siti', $log->details, 'catatan audit tidak memuat data pribadi');

        // Tamu & panitia tanpa sekolah ditolak.
        app('auth')->forgetGuards();
        $this->get('/api/v1/panitia/voters/export?format=student', ['Accept' => 'application/json'])->assertUnauthorized();
        $this->actingAs(\App\Models\User::factory()->create(['election_id' => null]));
        $this->get('/api/v1/panitia/voters/export?format=student', ['Accept' => 'application/json'])->assertForbidden();
    }
}
