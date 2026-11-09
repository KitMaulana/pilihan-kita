<?php

namespace Tests\Feature;

use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KioskFallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_siswa_masuk_dengan_nisn_dan_tanggal_lahir(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        Voter::factory()->create(['identifier' => '0071234567', 'name' => 'Siti', 'class_name' => 'X-3', 'birth_date' => '2009-07-21']);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0071234567', 'birth_date' => '2009-07-21'], $h)
            ->assertOk()->assertJsonPath('name', 'Siti')->assertJsonPath('class_name', 'X-3');

        $this->assertDatabaseHas('access_attempts', ['method' => 'fallback', 'result' => 'matched']);
    }

    public function test_tiga_kali_salah_terkunci_lalu_panitia_membuka(): void
    {
        $this->openElection(['max_fallback_attempts' => 3]);
        [, $h] = $this->device();
        $voter = Voter::factory()->create(['identifier' => '0071234567', 'birth_date' => '2009-07-21']);
        $wrong = ['type' => 'student', 'identifier' => '0071234567', 'birth_date' => '2009-01-01'];

        $this->postJson('/api/v1/kiosk/fallback', $wrong, $h)->assertStatus(422)->assertJsonPath('attempts_left', 2);
        $this->postJson('/api/v1/kiosk/fallback', $wrong, $h)->assertStatus(422)->assertJsonPath('attempts_left', 1);
        $this->postJson('/api/v1/kiosk/fallback', $wrong, $h)->assertStatus(423)->assertJsonPath('code', 'locked');

        // Percobaan ke-4 — bahkan dengan data BENAR — tetap terkunci.
        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0071234567', 'birth_date' => '2009-07-21'], $h)
            ->assertStatus(423);
        $this->assertNotNull($voter->fresh()->locked_at);

        $this->actingAs($this->panitia())->postJson("/api/v1/panitia/voters/{$voter->id}/unlock")->assertOk();

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0071234567', 'birth_date' => '2009-07-21'], $h)
            ->assertOk();
        $this->assertSame(0, $voter->fresh()->failed_attempts);
    }

    public function test_nomor_tidak_dikenal_memberi_pesan_generik(): void
    {
        $this->openElection();
        [, $h] = $this->device();

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0000000000', 'birth_date' => '2009-07-21'], $h)
            ->assertStatus(422)->assertJsonPath('code', 'wrong_data')->assertJsonPath('message', 'Data tidak cocok. Periksa kembali isian Anda.');
    }

    public function test_guru_dengan_nip(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        Voter::factory()->teacher('198001012005011001')->create(['name' => 'Pak Budi']);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'teacher', 'identifier' => '19800101 200501 1 001', 'birth_date' => '1980-01-01'], $h)
            ->assertOk()->assertJsonPath('name', 'Pak Budi')->assertJsonPath('class_name', 'Guru');
    }

    public function test_guru_tanpa_nip_dengan_nama_dan_tanggal_lahir(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        Voter::factory()->teacher()->create(['name' => 'Rina Marlina', 'birth_date' => '1990-05-12']);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'teacher', 'name' => '  rina   marlina ', 'birth_date' => '1990-05-12'], $h)
            ->assertOk()->assertJsonPath('name', 'Rina Marlina');
    }

    public function test_guru_tanpa_nip_ganda_minta_kode_pembeda(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        Voter::factory()->teacher()->create(['name' => 'Andi', 'birth_date' => '1975-03-03', 'distinguisher' => 'G-01']);
        Voter::factory()->teacher()->create(['name' => 'Andi', 'birth_date' => '1975-03-03', 'distinguisher' => 'G-02']);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'teacher', 'name' => 'Andi', 'birth_date' => '1975-03-03'], $h)
            ->assertStatus(422)->assertJsonPath('code', 'ambiguous_identity')->assertJsonPath('need_distinguisher', true);

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'teacher', 'name' => 'Andi', 'birth_date' => '1975-03-03', 'distinguisher' => 'g-02'], $h)
            ->assertOk();
    }

    public function test_batas_laju_per_perangkat(): void
    {
        config(['security.kiosk_rate.fallback' => 3]);
        $this->app->getProvider(\App\Providers\AppServiceProvider::class)->boot();
        $this->openElection();
        [, $h] = $this->device();
        $payload = ['type' => 'student', 'identifier' => '0000000000', 'birth_date' => '2009-07-21'];

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/kiosk/fallback', $payload, $h)->assertStatus(422);
        }
        $this->postJson('/api/v1/kiosk/fallback', $payload, $h)->assertStatus(429)->assertJsonPath('code', 'rate_limited');

        // Perangkat lain tidak terdampak.
        [, $h2] = $this->device('Tablet 2');
        $this->postJson('/api/v1/kiosk/fallback', $payload, $h2)->assertStatus(422);
    }
}
