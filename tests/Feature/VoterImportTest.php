<?php

namespace Tests\Feature;

use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class VoterImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->schoolSession(); // panel panitia selalu bekerja di dalam satu sesi (sekolah)
    }

    private function upload(string $csv, string $type = 'student')
    {
        return $this->post('/api/v1/panitia/voters/import/preview', [
            'type' => $type,
            'file' => UploadedFile::fake()->createWithContent('pemilih.csv', $csv),
        ], ['Accept' => 'application/json']);
    }

    public function test_pratinjau_memisahkan_baris_siap_dan_bermasalah(): void
    {
        $this->actingAs($this->panitia());

        $csv = "nisn,nama,kelas,tanggal_lahir\n"
            ."0071234567,Ahmad,XI IPA 1,2008-03-14\n"
            ."0079876543,Siti,X-3,21/07/2009\n"      // format DD/MM/YYYY → dinormalisasi
            ."0071234567,Duplikat,X-1,2008-01-01\n"  // NISN ganda
            ."71234568,Tanpa Nol,X-1,2008-01-01\n"   // nol depan hilang (Excel)
            ."0071111111,,X-1,2008-01-01\n"          // nama kosong
            ."0072222222,Tanggal Salah,X-1,2008-02-30\n";

        $res = $this->upload($csv)->assertOk();

        $res->assertJsonPath('summary.total', 6)
            ->assertJsonPath('summary.ready', 2)
            ->assertJsonPath('summary.problems', 4)
            ->assertJsonPath('ready.1.birth_date', '2009-07-21');

        $errors = collect($res->json('problems'))->pluck('errors')->flatten()->implode(' | ');
        $this->assertStringContainsString('Duplikat NISN', $errors);
        $this->assertStringContainsString('Excel', $errors);
        $this->assertStringContainsString('Nama kosong', $errors);
        $this->assertStringContainsString('Tanggal lahir tidak valid', $errors);
    }

    public function test_konfirmasi_menyimpan_baris_siap_dan_memperbarui_yang_ada(): void
    {
        $this->actingAs($this->panitia());
        Voter::factory()->create(['identifier' => '0071234567', 'name' => 'Nama Lama']);

        $token = $this->upload("nisn;nama;kelas;tanggal_lahir\n0071234567;Nama Baru;XI IPA 1;2008-03-14\n0070000001;Budi;X-2;2009-01-01\n")
            ->assertOk()->assertJsonPath('summary.update', 1)->assertJsonPath('summary.new', 1)
            ->json('token');

        $this->postJson('/api/v1/panitia/voters/import/commit', ['token' => $token])
            ->assertOk()->assertJsonPath('created', 1)->assertJsonPath('updated', 1);

        $this->assertDatabaseHas('voters', ['identifier' => '0071234567', 'name' => 'Nama Baru']);
        $this->assertSame(2, Voter::count());

        // Token sekali pakai.
        $this->postJson('/api/v1/panitia/voters/import/commit', ['token' => $token])->assertStatus(422);
    }

    public function test_guru_tanpa_nip_dan_deteksi_nama_tanggal_ganda(): void
    {
        $this->actingAs($this->panitia());

        $csv = "nip,nama,tanggal_lahir,kode\n"
            ."198001012005011001,Budi Santoso,1980-01-01,\n"
            .",Rina Marlina,1990-05-12,\n"
            .",Dewi Lestari,1985-02-02,\n"
            .",Dewi Lestari,1985-02-02,\n"          // ganda tanpa kode → bermasalah
            .",Andi,1975-03-03,G-01\n"
            .",Andi,1975-03-03,G-02\n";             // ganda tapi kode berbeda → siap

        $res = $this->upload($csv, 'teacher')->assertOk();
        $res->assertJsonPath('summary.ready', 4)->assertJsonPath('summary.problems', 2);

        $this->postJson('/api/v1/panitia/voters/import/commit', ['token' => $res->json('token')])->assertOk();
        $this->assertSame(2, Voter::where('name', 'Andi')->count());
        $this->assertSame(0, Voter::where('name', 'Dewi Lestari')->count());
    }

    public function test_kolom_wajib_hilang_ditolak(): void
    {
        $this->actingAs($this->panitia());
        $this->upload("nisn,nama\n0071234567,Ahmad\n")->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_templat_csv_bisa_diunduh(): void
    {
        $this->actingAs($this->panitia());
        $res = $this->get('/api/v1/panitia/voters/template/student')->assertOk();
        $this->assertStringStartsWith('nisn,nama,kelas,tanggal_lahir', $res->getContent());
    }

    public function test_daftar_pemilih_bisa_dicari_dan_difilter(): void
    {
        $this->actingAs($this->panitia());
        Voter::factory()->create(['name' => 'Ahmad Fauzi', 'class_name' => 'X-1']);
        Voter::factory()->create(['name' => 'Siti Aminah', 'class_name' => 'X-2']);
        $this->voterWithFace(3, ['name' => 'Bambang', 'class_name' => 'X-2']);

        $this->getJson('/api/v1/panitia/voters?q=ahmad')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/panitia/voters?class_name=X-2')->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/panitia/voters?face=yes')->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.face.registered', true)
            ->assertJsonMissingPath('data.0.face.embedding');
    }
}
