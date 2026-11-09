<?php

namespace Tests\Feature;

use App\Models\AccessAttempt;
use App\Models\Election;
use App\Models\Voter;
use App\Services\FaceMatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KioskIdentifyTest extends TestCase
{
    use RefreshDatabase;

    public function test_tanpa_device_token_ditolak(): void
    {
        $this->openElection();
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)))
            ->assertStatus(401)->assertJsonPath('code', 'device_unauthorized');
    }

    public function test_token_dicabut_langsung_ditolak(): void
    {
        $this->openElection();
        [$device, $h] = $this->device();
        $this->getJson('/api/v1/kiosk/status', $h)->assertOk();

        $this->actingAs($this->panitia())->postJson("/api/v1/panitia/devices/{$device->id}/revoke")->assertOk();

        $this->getJson('/api/v1/kiosk/status', $h)->assertStatus(401);
    }

    public function test_wajah_cocok_mengembalikan_nama_kelas_tanpa_data_biometrik(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $voter = $this->voterWithFace(1, ['name' => 'Ahmad', 'class_name' => 'XI IPA 1']);
        $this->voterWithFace(2);

        $res = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1, [2 => 0.2])), $h)
            ->assertOk()
            ->assertJsonPath('name', 'Ahmad')
            ->assertJsonPath('class_name', 'XI IPA 1')
            ->assertJsonStructure(['ticket', 'expires_in', 'name', 'class_name']);

        $this->assertStringNotContainsString('embedding', $res->getContent());
        $this->assertStringNotContainsString($voter->identifier, $res->getContent());
        $this->assertDatabaseHas('access_attempts', ['voter_id' => $voter->id, 'result' => 'matched', 'method' => 'face']);
    }

    public function test_skor_di_bawah_ambang_tidak_dikenali(): void
    {
        $this->openElection(['match_threshold' => 0.6]);
        [, $h] = $this->device();
        $this->voterWithFace(1);

        // cos = 1/sqrt(1+3) = 0.5 terhadap sumbu 1 (< ambang 0.6)
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1, [3 => sqrt(3)])), $h)
            ->assertStatus(422)->assertJsonPath('code', 'not_recognized');

        $this->assertDatabaseHas('access_attempts', ['result' => 'not_matched']);
    }

    public function test_dua_kandidat_skor_mirip_dianggap_ambigu(): void
    {
        $this->openElection(['match_threshold' => 0.5, 'match_margin' => 0.08]);
        [, $h] = $this->device();
        $this->voterWithFace(1);
        $this->voterWithFace(2);

        // Tepat di tengah sumbu 1 dan 2: s1 ≈ s2 ≈ 0.707
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1, [2 => 1.0])), $h)
            ->assertStatus(422)->assertJsonPath('code', 'not_recognized');

        $this->assertDatabaseHas('access_attempts', ['result' => 'ambiguous']);
    }

    public function test_liveness_gagal_dialihkan_ke_cadangan_dan_dicatat_mencurigakan(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $this->voterWithFace(1);

        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1), liveness: false), $h)
            ->assertStatus(422)->assertJsonPath('code', 'liveness_failed');

        $this->assertDatabaseHas('access_attempts', ['result' => 'liveness_failed', 'is_suspicious' => true]);
    }

    public function test_pemilih_yang_sudah_memilih_ditolak(): void
    {
        $election = $this->openElection();
        [, $h] = $this->device();
        $voter = $this->voterWithFace(1);
        \DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);

        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)
            ->assertStatus(409)->assertJsonPath('code', 'already_voted');
    }

    public function test_di_luar_jam_voting_ditolak(): void
    {
        $election = $this->openElection();
        [, $h] = $this->device();
        $this->voterWithFace(1);

        $election->update(['opens_at' => now()->addHour(), 'closes_at' => now()->addHours(2)]);
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)
            ->assertStatus(403)->assertJsonPath('code', 'voting_closed')->assertJsonPath('message', 'Pemilihan belum dimulai.');

        $election->update(['opens_at' => now()->subHours(2), 'closes_at' => now()->subHour()]);
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->assertStatus(403);

        $election->update(['status' => Election::DRAFT, 'closes_at' => now()->addHour()]);
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->assertStatus(403);
    }

    public function test_vektor_tidak_ternormalisasi_ditolak(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload(array_fill(0, 512, 1.0)), $h)
            ->assertStatus(422)->assertJsonPath('code', 'invalid_embedding');
    }

    public function test_status_kiosk_memberi_info_tanpa_harus_jam_buka(): void
    {
        $election = $this->openElection();
        $election->update(['status' => Election::DRAFT]);
        [, $h] = $this->device('Tablet Aula');

        $this->getJson('/api/v1/kiosk/status', $h)->assertOk()
            ->assertJsonPath('device.name', 'Tablet Aula')
            ->assertJsonPath('election.is_voting_open', false)
            ->assertJsonPath('election.closed_reason', 'Pemilihan belum dibuka.');
    }

    public function test_menolak_konfirmasi_nama_dicatat_dan_tiket_hangus(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $this->voterWithFace(1);
        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->json('ticket');

        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => false], $h)
            ->assertOk()->assertJsonPath('confirmed', false);
        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)->assertStatus(410);

        $this->assertDatabaseHas('access_attempts', ['result' => 'rejected', 'is_suspicious' => true]);
    }

    public function test_tiket_dari_tablet_lain_tidak_berlaku(): void
    {
        $this->openElection();
        [, $h1] = $this->device('A');
        [, $h2] = $this->device('B');
        $this->voterWithFace(1);
        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h1)->json('ticket');

        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h2)
            ->assertStatus(410)->assertJsonPath('code', 'session_invalid');
    }

    public function test_tiket_kedaluwarsa(): void
    {
        $this->openElection(['ticket_identified_ttl' => 60]);
        [, $h] = $this->device();
        $this->voterWithFace(1);
        $ticket = $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->json('ticket');

        $this->travel(2)->minutes();
        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $h)
            ->assertStatus(410)->assertJsonPath('code', 'session_expired');
    }

    public function test_waktu_percobaan_dibulatkan_ke_menit(): void
    {
        $this->travelTo(now()->setTime(10, 15, 42));
        $this->openElection();
        [, $h] = $this->device();
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(9)), $h);

        $this->assertSame(0, AccessAttempt::first()->created_at->second);
    }

    public function test_pemilih_nonaktif_tidak_bisa_masuk(): void
    {
        $this->openElection();
        [, $h] = $this->device();
        $voter = $this->voterWithFace(1);
        Voter::whereKey($voter->id)->update(['is_active' => false]);
        app(FaceMatchService::class)->flush();

        // Template pemilih nonaktif dikeluarkan dari matriks → tidak dikenali.
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $h)->assertStatus(422);
    }
}
