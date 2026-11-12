<?php

namespace Tests\Feature;

use App\Models\Candidate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Foto kandidat: diperkecil saat unggah, URL tidak rusak bila berkas hilang, perintah diagnosis. */
class CandidatePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->actingAs($this->panitia($this->schoolSession('SMAN Foto')));
    }

    private function upload(string $name = 'a.png', int $w = 3000, int $h = 4000)
    {
        return $this->post('/api/v1/panitia/candidates', [
            'number' => 1, 'name' => 'Raka & Nadia', 'photo' => UploadedFile::fake()->image($name, $w, $h),
        ], ['Accept' => 'application/json']);
    }

    public function test_foto_diperkecil_dan_disimpan_sebagai_jpeg(): void
    {
        $res = $this->upload('besar.png', 3000, 4000)->assertCreated();
        $c = Candidate::find($res->json('data.id'));

        $this->assertStringEndsWith('.jpg', $c->photo_path);
        Storage::disk('public')->assertExists($c->photo_path);
        [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($c->photo_path));
        $this->assertSame(1000, max($w, $h), 'sisi terpanjang dibatasi 1000 px');
        $this->assertSame(750, min($w, $h), 'rasio gambar terjaga');
    }

    public function test_foto_kecil_tidak_diperbesar(): void
    {
        $c = Candidate::find($this->upload('kecil.jpg', 300, 400)->json('data.id'));
        [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($c->photo_path));
        $this->assertSame([300, 400], [$w, $h]);
    }

    public function test_mengganti_foto_menghapus_berkas_lama(): void
    {
        $c = Candidate::find($this->upload()->json('data.id'));
        $old = $c->photo_path;

        $this->post('/api/v1/panitia/candidates/'.$c->id, ['number' => 1, 'name' => 'Raka & Nadia', 'photo' => UploadedFile::fake()->image('b.jpg', 500, 500)], ['Accept' => 'application/json'])->assertOk();

        Storage::disk('public')->assertMissing($old);
        $this->assertNotSame($old, $c->fresh()->photo_path);
        Storage::disk('public')->assertExists($c->fresh()->photo_path);
    }

    public function test_foto_hilang_tidak_mengirim_url_rusak_dan_ditandai(): void
    {
        $c = Candidate::find($this->upload()->json('data.id'));
        $this->getJson('/api/v1/panitia/candidates')->assertJsonPath('data.0.photo_missing', false)->assertJsonPath('data.0.photo_url', fn ($u) => str_contains($u, '/photo'));

        Storage::disk('public')->delete($c->photo_path); // berkas hilang dari server

        $this->getJson('/api/v1/panitia/candidates')->assertJsonPath('data.0.photo_missing', true)->assertJsonPath('data.0.photo_url', null);
    }

    public function test_endpoint_foto_cache_panjang_dan_404_bila_tak_ada(): void
    {
        $c = Candidate::find($this->upload()->json('data.id'));

        $res = $this->get('/api/v1/public/candidates/'.$c->id.'/photo')->assertOk();
        $this->assertStringContainsString('immutable', $res->headers->get('Cache-Control'));
        $this->assertStringStartsWith('image/', $res->headers->get('Content-Type'));

        Storage::disk('public')->delete($c->photo_path);
        $this->get('/api/v1/public/candidates/'.$c->id.'/photo')->assertNotFound();
    }

    public function test_perintah_diagnosis_melaporkan_hilang_dan_memperkecil(): void
    {
        $ok = Candidate::find($this->upload()->json('data.id'));
        $lost = Candidate::create(['election_id' => $ok->election_id, 'number' => 2, 'name' => 'Hilang', 'photo_path' => 'candidates/tidak-ada.jpg']);

        // Foto besar lama (belum diperkecil) diletakkan langsung.
        $big = Candidate::create(['election_id' => $ok->election_id, 'number' => 3, 'name' => 'Besar', 'photo_path' => 'candidates/besar-lama.png']);
        Storage::disk('public')->put($big->photo_path, UploadedFile::fake()->image('x.png', 3000, 3000)->get());
        $before = Storage::disk('public')->size($big->photo_path);

        $this->artisan('candidates:photos')->expectsOutputToContain('HILANG')->assertSuccessful();

        $this->artisan('candidates:photos --optimize')->expectsOutputToContain('diperkecil')->assertSuccessful();
        $big->refresh();
        $this->assertStringEndsWith('.jpg', $big->photo_path);
        $this->assertLessThan($before, Storage::disk('public')->size($big->photo_path));
        Storage::disk('public')->assertMissing('candidates/besar-lama.png');
        $this->assertSame('candidates/tidak-ada.jpg', $lost->fresh()->photo_path, 'foto hilang tidak diubah');
    }
}
