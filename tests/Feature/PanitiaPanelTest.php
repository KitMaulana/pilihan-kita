<?php

namespace Tests\Feature;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\KioskDevice;
use App\Models\Voter;
use App\Services\SimulationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PanitiaPanelTest extends TestCase
{
    use RefreshDatabase;

    public function test_kandidat_bisa_dikelola_saat_draf_saja(): void
    {
        Storage::fake('public');
        $this->actingAs($this->panitia());
        $election = Election::create(['name' => 'X', 'status' => Election::DRAFT]);

        $id = $this->post('/api/v1/panitia/candidates', [
            'number' => 1, 'name' => 'Raka & Nadia', 'vision' => 'Visi', 'photo' => UploadedFile::fake()->image('a.jpg', 300, 400),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->assertNotNull(Candidate::find($id)->photo_path);
        $this->postJson('/api/v1/panitia/candidates', ['number' => 1, 'name' => 'Dobel'])->assertStatus(422)->assertJsonValidationErrors('number');

        $election->update(['status' => Election::OPEN]);
        $this->postJson("/api/v1/panitia/candidates/{$id}", ['name' => 'Ubah'])->assertStatus(422);
        $this->deleteJson("/api/v1/panitia/candidates/{$id}")->assertStatus(422);
    }

    public function test_registrasi_perangkat_menampilkan_token_sekali(): void
    {
        $session = $this->schoolSession();
        $this->actingAs($this->panitia());

        $res = $this->postJson('/api/v1/panitia/devices', ['name' => 'Tablet Aula'])->assertCreated();
        $token = $res->json('token');
        $this->assertStringStartsWith('kd_', $token);
        $this->assertStringContainsString('#token=', $res->json('setup_url'));

        // Token tersimpan sebagai hash; daftar perangkat tidak memuat token/hash.
        $this->assertDatabaseMissing('kiosk_devices', ['token_hash' => $token]);
        $this->assertNotNull(KioskDevice::findByToken($token));
        $list = $this->getJson('/api/v1/panitia/devices')->assertOk()->getContent();
        $this->assertStringNotContainsString('token', $list);
    }

    public function test_dashboard_menampilkan_anomali(): void
    {
        $election = $this->openElection();
        [, $h] = $this->device('Tablet Curiga');
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1), liveness: false), $h);
        }
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0000000000', 'birth_date' => '2009-01-01'], $h);
        }

        $res = $this->actingAs($this->panitia())->getJson('/api/v1/panitia/dashboard')->assertOk();
        $types = collect($res->json('anomalies'))->pluck('type');
        $this->assertTrue($types->contains('liveness'));
        $this->assertTrue($types->contains('failed_attempts'));
        $this->assertTrue($types->contains('streak'));
    }

    public function test_log_percobaan_bisa_difilter_dan_diekspor_csv(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '0000000000', 'birth_date' => '2009-01-01'], $h);

        $this->actingAs($this->panitia());
        $this->getJson('/api/v1/panitia/logs/attempts?method=fallback')->assertOk()->assertJsonCount(1, 'data');
        $csv = $this->get('/api/v1/panitia/logs/attempts/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('waktu_wib,perangkat,metode', $csv);
        $this->assertStringContainsString('wrong_data', $csv);
    }

    public function test_jadwal_disimpan_utc(): void
    {
        Election::create(['name' => 'X', 'status' => Election::DRAFT]);
        $this->actingAs($this->panitia());

        $this->putJson('/api/v1/panitia/election', ['opens_at' => '2026-11-20T07:00:00+07:00', 'closes_at' => '2026-11-20T13:00:00+07:00'])
            ->assertOk()->assertJsonPath('data.opens_at', '2026-11-20T00:00:00+00:00');
    }

    public function test_simulasi_bisa_dibuat_dan_dihapus_bersih_tanpa_menyentuh_data_nyata(): void
    {
        $real = Voter::factory()->create();
        $sim = app(SimulationService::class)->create(10, 2, withFaces: true);
        $this->assertSame(11, Voter::count());
        $this->assertTrue(Election::current()->is_simulation);

        $this->actingAs($this->admin())->postJson('/api/v1/panitia/simulation/purge', ['confirm' => 'HAPUS SIMULASI'])->assertOk();

        $this->assertSame(1, Voter::count());
        $this->assertNotNull($real->fresh());
        $this->assertNull(Election::find($sim['election']->id));
    }

    public function test_pemilih_sekolah_lain_tidak_bisa_checkin_di_tablet_sekolah_ini(): void
    {
        $other = $this->schoolSession('SMA Lain', Election::OPEN);
        Voter::factory()->create(['identifier' => '9900000001', 'election_id' => $other->id]);
        $this->openElection(); // sesi tablet (terbaru)
        [, $h] = $this->device();

        $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => '9900000001', 'birth_date' => '2008-05-17'], $h)
            ->assertStatus(422);
    }
}
