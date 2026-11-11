<?php

namespace Tests\Feature;

use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\KioskDevice;
use App\Models\User;
use App\Models\Vote;
use App\Models\Voter;
use App\Services\FaceMatchService;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Multi-sekolah: beberapa sesi berjalan bersamaan dengan data yang benar-benar terpisah. */
class MultiSchoolTest extends TestCase
{
    use RefreshDatabase;

    private function openSession(string $school): Election
    {
        $e = Election::create([
            'name' => 'Pemilihan Ketua OSIS', 'school_name' => $school, 'status' => Election::OPEN,
            'opens_at' => now()->subHour(), 'closes_at' => now()->addHour(), 'settings' => Election::DEFAULT_SETTINGS,
        ]);
        $e->candidates()->create(['number' => 1, 'name' => "Kandidat {$school}"]);

        return $e;
    }

    private function deviceFor(Election $e, string $role = KioskDevice::CHECKIN): array
    {
        [, $token] = KioskDevice::register("{$role} {$e->school_name}", null, $role, $e->id);

        return ['X-Device-Token' => $token, 'Accept' => 'application/json'];
    }

    private function faceVoter(Election $e, int $axis, string $nisn): Voter
    {
        $v = Voter::factory()->create(['election_id' => $e->id, 'identifier' => $nisn]);
        FaceTemplate::create(['voter_id' => $v->id, 'embedding' => FaceTemplate::pack($this->vec($axis)), 'model_version' => self::MODEL]);
        app(FaceMatchService::class)->flush();

        return $v;
    }

    public function test_dua_sekolah_berjalan_bersamaan_dengan_data_terpisah(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMAN 2 Serang');
        $checkinA = $this->deviceFor($a);
        $boothA = $this->deviceFor($a, KioskDevice::BOOTH);
        $boothB = $this->deviceFor($b, KioskDevice::BOOTH);

        // NISN sama boleh ada di dua sekolah (unik per sesi), wajah sama persis di dua sekolah.
        $voterA = $this->faceVoter($a, 1, '0071111111');
        $voterB = $this->faceVoter($b, 1, '0071111111');

        // Tablet sekolah A hanya mengenali pemilih sekolah A.
        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($this->vec(1)), $checkinA)
            ->assertOk()->assertJsonPath('name', $voterA->name);
        $this->getJson('/api/v1/kiosk/status', $checkinA)->assertJsonPath('election.school_name', 'SMAN 1 Ciruas');

        // Check-in di A → hanya bilik A yang siap; bilik B tidak bisa memakai hak masuk A.
        $this->checkInByNisn($checkinA, '0071111111');
        $this->getJson('/api/v1/kiosk/booth/status', $boothB)->assertJson(['ready' => false]);
        $this->boothVote($boothB, $b->candidates()->first()->id)->assertStatus(409)->assertJsonPath('code', 'no_checkin');
        $this->boothVote($boothA, $a->candidates()->first()->id)->assertCreated();

        // Hanya pemilih A yang ditandai; B tetap bisa check-in di sekolahnya.
        $this->assertTrue($voterA->fresh()->has_voted);
        $this->assertFalse($voterB->fresh()->has_voted);

        // Kandidat sekolah lain ditolak di bilik.
        $this->boothVote($boothA, $b->candidates()->first()->id)->assertStatus(422)->assertJsonPath('code', 'invalid_candidate');

        // Hasil publik per sekolah.
        $this->getJson("/api/v1/public/results?session={$a->slug}")->assertJsonPath('candidates.0.votes', 1)->assertJsonPath('election.school_name', 'SMAN 1 Ciruas');
        $this->getJson("/api/v1/public/results?session={$b->slug}")->assertJsonPath('candidates.0.votes', 0)->assertJsonPath('participation.all.voted', 0);
        $this->assertTrue(app(LedgerService::class)->verify($a)['ok']);
        $this->assertTrue(app(LedgerService::class)->verify($b)['ok']);
    }

    public function test_daftar_sekolah_publik_tanpa_draf_dan_slug_tidak_dikenal(): void
    {
        $this->openSession('SMAN 1 Ciruas');
        Election::create(['name' => 'Rahasia', 'school_name' => 'SMA Draf', 'status' => Election::DRAFT]);

        $res = $this->getJson('/api/v1/public/sessions')->assertOk();
        $this->assertSame(['SMAN 1 Ciruas'], collect($res->json('data'))->pluck('school_name')->all());
        $this->getJson('/api/v1/public/results?session=tidak-ada')->assertNotFound();
        $this->getJson('/api/v1/public/results?session=sma-draf')->assertNotFound();
    }

    public function test_admin_memilih_sesi_lewat_header(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMAN 2 Serang');
        Voter::factory()->count(2)->create(['election_id' => $a->id]);
        Voter::factory()->count(3)->create(['election_id' => $b->id]);
        $this->actingAs($this->admin());

        $this->getJson('/api/v1/panitia/voters', ['X-Session-Id' => $a->id])->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/panitia/voters', ['X-Session-Id' => $b->id])->assertJsonPath('meta.total', 3);
        $this->getJson('/api/v1/panitia/election', ['X-Session-Id' => $a->id])->assertJsonPath('data.school_name', 'SMAN 1 Ciruas');

        $list = $this->getJson('/api/v1/panitia/sessions', ['X-Session-Id' => $a->id])->assertOk();
        $this->assertCount(2, $list->json('data'));
        $list->assertJsonPath('current_id', $a->id)->assertJsonPath('restricted', false);
    }

    public function test_panitia_sekolah_tidak_bisa_mengakses_sekolah_lain(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMAN 2 Serang');
        $voterB = Voter::factory()->create(['election_id' => $b->id]);
        [$deviceB] = KioskDevice::register('Tablet B', null, KioskDevice::CHECKIN, $b->id);
        $panitiaA = User::factory()->create(['election_id' => $a->id]);
        $this->actingAs($panitiaA);

        // Tanpa header → otomatis sesi sendiri; meminta sesi lain → 403.
        $this->getJson('/api/v1/panitia/election')->assertJsonPath('data.school_name', 'SMAN 1 Ciruas');
        $this->getJson('/api/v1/panitia/election', ['X-Session-Id' => $b->id])->assertForbidden()->assertJsonPath('code', 'session_forbidden');
        $this->getJson('/api/v1/panitia/sessions')->assertJsonCount(1, 'data')->assertJsonPath('restricted', true);

        // Data sekolah B tidak bisa disentuh lewat ID langsung.
        $this->patchJson("/api/v1/panitia/voters/{$voterB->id}", ['name' => 'Diubah'])->assertNotFound();
        $this->postJson("/api/v1/panitia/voters/{$voterB->id}/unlock")->assertNotFound();
        $this->postJson("/api/v1/panitia/devices/{$deviceB->id}/revoke")->assertNotFound();
        $this->postJson('/api/v1/panitia/face-templates', ['voter_id' => $voterB->id, 'embedding' => $this->vec(3), 'model_version' => self::MODEL])->assertNotFound();
        $this->getJson('/api/v1/panitia/devices')->assertJsonCount(0, 'data');
        $this->assertSame($voterB->name, $voterB->fresh()->name);

        // Pembuatan / penghapusan sesi khusus admin.
        $this->postJson('/api/v1/panitia/election', ['school_name' => 'X', 'name' => 'Y'])->assertForbidden();
    }

    public function test_admin_selalu_tanpa_batasan_sesi(): void
    {
        $a = $this->schoolSession('SMAN 1 Ciruas');
        $this->actingAs($this->admin());

        $res = $this->postJson('/api/v1/panitia/users', [
            'name' => 'Admin Dua', 'email' => 'admin2@contoh.id', 'password' => 'rahasia12345', 'role' => 'admin', 'election_id' => $a->id,
        ])->assertCreated();
        $this->assertNull($res->json('data.election_id'));

        $res = $this->postJson('/api/v1/panitia/users', [
            'name' => 'Panitia A', 'email' => 'pa@contoh.id', 'password' => 'rahasia12345', 'role' => 'panitia', 'election_id' => $a->id,
        ])->assertCreated();
        $res->assertJsonPath('data.election_id', $a->id)->assertJsonPath('data.election_label', 'SMAN 1 Ciruas — Pemilihan Ketua OSIS');
    }

    public function test_hapus_sesi_hanya_bila_belum_ada_checkin(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMA Salah Buat');
        Voter::factory()->create(['election_id' => $b->id]);
        $this->actingAs($this->admin());

        $this->deleteJson('/api/v1/panitia/election', ['confirm' => 'hapus'], ['X-Session-Id' => $b->id])->assertStatus(422);
        $this->deleteJson('/api/v1/panitia/election', ['confirm' => 'HAPUS SESI'], ['X-Session-Id' => $b->id])->assertOk();
        $this->assertNull(Election::find($b->id));
        $this->assertSame(0, Voter::where('election_id', $b->id)->count());

        // Sesi dengan check-in tidak bisa dihapus.
        $this->checkInByNisn($this->deviceFor($a), Voter::factory()->create(['election_id' => $a->id])->identifier);
        $this->deleteJson('/api/v1/panitia/election', ['confirm' => 'HAPUS SESI'], ['X-Session-Id' => $a->id])->assertStatus(422);
        $this->assertNotNull(Election::find($a->id));
    }

    public function test_tutup_otomatis_semua_sesi_yang_lewat_jam(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMAN 2 Serang');
        $a->update(['closes_at' => now()->subMinute()]);
        $b->update(['closes_at' => now()->subMinute()]);

        $this->artisan('election:auto-close')->assertExitCode(0);

        $this->assertSame(Election::CLOSED, $a->fresh()->status);
        $this->assertSame(Election::CLOSED, $b->fresh()->status);
        $this->assertSame(0, Vote::count());
    }

    public function test_retensi_wajah_hanya_untuk_sesi_aktif(): void
    {
        $a = $this->openSession('SMAN 1 Ciruas');
        $b = $this->openSession('SMAN 2 Serang');
        $this->faceVoter($a, 1, '0071111111');
        $this->faceVoter($b, 2, '0072222222');
        $this->actingAs($this->admin());

        $this->postJson('/api/v1/panitia/face-templates/purge', ['confirm' => 'HAPUS SEMUA WAJAH'], ['X-Session-Id' => $a->id])
            ->assertOk()->assertJsonPath('deleted', 1);
        $this->assertSame(1, FaceTemplate::count(), 'Template sekolah B tidak boleh ikut terhapus.');
    }
}
