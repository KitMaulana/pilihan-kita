<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Revisi 2026-11-10: tutup draf, input pemilih satuan, unggah kandidat. */
class PanitiaRevisionTest extends TestCase
{
    use RefreshDatabase;

    public function test_nomor_urut_berawalan_nol_diterima_dan_foto_bisa_diakses_tanpa_symlink(): void
    {
        Storage::fake('public');
        $this->actingAs($this->panitia());
        Election::create(['name' => 'X', 'status' => Election::DRAFT]);

        $res = $this->post('/api/v1/panitia/candidates', [
            'number' => '01', 'name' => '  Raka   &  Nadia ', 'class_name' => '', 'vision' => 'v', 'mission' => 'm', 'is_active' => '1',
            'photo' => UploadedFile::fake()->image('9900000010.jpg', 300, 400),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(1, $res->json('data.number'));
        $this->assertSame('Raka & Nadia', $res->json('data.name'));
        $url = $res->json('data.photo_url');
        $this->assertStringStartsWith('/api/v1/public/candidates/', $url);

        // Foto dilayani lewat PHP (publik, tanpa login).
        auth()->guard('web')->logout();
        $this->get($url)->assertOk()->assertHeader('Cache-Control');
    }

    public function test_server_menolak_format_foto_tak_didukung_dengan_pesan_yang_menunjuk_solusi(): void
    {
        $this->actingAs($this->panitia($this->schoolSession()));

        foreach (['foto.heic' => 'image/heic', 'foto.gif' => 'image/gif', 'catatan.pdf' => 'application/pdf'] as $name => $mime) {
            $res = $this->post('/api/v1/panitia/candidates', [
                'number' => 1, 'name' => 'Uji', 'photo' => UploadedFile::fake()->create($name, 50, $mime),
            ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('photo');
            $this->assertStringContainsString('JPG, PNG, atau WebP', $res->json('errors.photo.0'));
        }
        $this->assertSame(0, Candidate::count());
    }

    public function test_pesan_validasi_kandidat_berbahasa_indonesia(): void
    {
        $this->actingAs($this->panitia());
        Election::create(['name' => 'X', 'status' => Election::DRAFT]);

        $this->postJson('/api/v1/panitia/candidates', ['number' => 'abc', 'name' => ''])
            ->assertStatus(422)
            ->assertJsonPath('errors.number.0', 'Nomor urut harus berupa angka bulat (mis. 1, 2, 3).')
            ->assertJsonPath('errors.name.0', 'Nama kandidat wajib diisi.');
    }

    public function test_draf_bisa_langsung_ditutup_lalu_buat_pemilihan_baru(): void
    {
        $election = $this->schoolSession('SMAN Uji');
        $this->actingAs($this->panitia($election));

        $this->getJson('/api/v1/panitia/election')
            ->assertJsonPath('data.allowed_transitions', [Election::OPEN, Election::CLOSED])
            ->assertJsonPath('data.can_delete', true);

        // Tanpa kandidat / pemilih sekalipun.
        $this->postJson('/api/v1/panitia/election/status', ['status' => 'closed', 'confirm' => 'TUTUP'])
            ->assertOk()->assertJsonPath('data.status', Election::CLOSED);

        $this->getJson('/api/v1/panitia/election')
            ->assertJsonPath('data.votes_count', 0)
            ->assertJsonPath('data.can_create_new', true);

        // Membuat sesi baru khusus admin (multi-sekolah: boleh kapan saja).
        $this->postJson('/api/v1/panitia/election', ['school_name' => 'SMA Baru', 'name' => 'Baru'])->assertForbidden();
        $this->actingAs($this->admin());
        $this->postJson('/api/v1/panitia/election', ['school_name' => 'SMA Baru', 'name' => 'Baru'])->assertCreated()->assertJsonPath('data.slug', 'sma-baru');
        $this->assertSame(2, Election::count());
    }

    public function test_tambah_pemilih_satuan(): void
    {
        $this->schoolSession();
        $this->actingAs($this->panitia());

        $this->postJson('/api/v1/panitia/voters', [
            'type' => 'student', 'identifier' => '0071 234.567', 'name' => ' Ahmad  Fauzi ', 'class_name' => 'XI IPA 1', 'birth_date' => '2008-03-14',
        ])->assertCreated()->assertJsonPath('data.identifier', '0071234567')->assertJsonPath('data.name', 'Ahmad Fauzi');

        // NISN ganda ditolak dengan nama pemilik yang sudah ada.
        $this->postJson('/api/v1/panitia/voters', [
            'type' => 'student', 'identifier' => '0071234567', 'name' => 'Lain', 'class_name' => 'X-1', 'birth_date' => '2008-01-01',
        ])->assertStatus(422)->assertJsonValidationErrors('identifier');

        // Validasi format.
        $this->postJson('/api/v1/panitia/voters', ['type' => 'student', 'identifier' => '123', 'name' => 'A', 'birth_date' => '2008-01-01'])
            ->assertStatus(422)->assertJsonValidationErrors(['identifier', 'class_name']);

        // Guru tanpa NIP: nama + tgl lahir ganda wajib dibedakan kode.
        $teacher = ['type' => 'teacher', 'identifier' => '', 'name' => 'Rina Marlina', 'birth_date' => '1990-05-12'];
        $this->postJson('/api/v1/panitia/voters', $teacher)->assertCreated();
        $this->postJson('/api/v1/panitia/voters', $teacher)->assertStatus(422)->assertJsonValidationErrors('distinguisher');

        $this->assertSame(2, Voter::count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'voter.created']);
    }

    public function test_tamu_tidak_bisa_menambah_pemilih(): void
    {
        $this->postJson('/api/v1/panitia/voters', ['type' => 'student'])->assertUnauthorized();
        $this->assertSame(0, Candidate::count());
    }
}
