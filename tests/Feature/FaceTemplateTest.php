<?php

namespace Tests\Feature;

use App\Models\FaceTemplate;
use App\Models\Voter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FaceTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->schoolSession(); // panel panitia selalu bekerja di dalam satu sesi (sekolah)
    }

    public function test_template_tersimpan_sebagai_biner_dan_tidak_bocor_di_respons(): void
    {
        $this->actingAs($this->panitia());
        $voter = Voter::factory()->create();

        $res = $this->postJson('/api/v1/panitia/face-templates', [
            'voter_id' => $voter->id, 'embedding' => $this->vec(1), 'model_version' => self::MODEL, 'quality_score' => 0.9,
        ])->assertCreated()->assertJsonPath('duplicate', null);

        $this->assertStringNotContainsString('embedding', $res->getContent());
        $tpl = FaceTemplate::first();
        $this->assertSame(512 * 4, strlen($tpl->embedding));
        $this->assertArrayNotHasKey('embedding', $tpl->toArray());
    }

    public function test_dimensi_norma_dan_versi_model_divalidasi(): void
    {
        $this->actingAs($this->panitia());
        $voter = Voter::factory()->create();

        $this->postJson('/api/v1/panitia/face-templates', ['voter_id' => $voter->id, 'embedding' => array_fill(0, 128, 0.1), 'model_version' => self::MODEL])
            ->assertStatus(422)->assertJsonValidationErrors('embedding');

        $this->postJson('/api/v1/panitia/face-templates', ['voter_id' => $voter->id, 'embedding' => array_fill(0, 512, 0.5), 'model_version' => self::MODEL])
            ->assertStatus(422)->assertJsonValidationErrors('embedding'); // norma ≠ 1

        $this->postJson('/api/v1/panitia/face-templates', ['voter_id' => $voter->id, 'embedding' => $this->vec(0), 'model_version' => 'model-lain'])
            ->assertStatus(422)->assertJsonValidationErrors('model_version');
    }

    public function test_wajah_ganda_antar_pemilih_ditandai(): void
    {
        $this->actingAs($this->panitia());
        $a = $this->voterWithFace(5, ['name' => 'Kembar A']);
        $b = Voter::factory()->create(['name' => 'Kembar B']);

        $this->postJson('/api/v1/panitia/face-templates', [
            'voter_id' => $b->id, 'embedding' => $this->vec(5, [6 => 0.1]), 'model_version' => self::MODEL,
        ])->assertCreated()->assertJsonPath('duplicate.voter_id', $a->id);

        $this->assertSame($a->id, FaceTemplate::where('voter_id', $b->id)->value('duplicate_of_voter_id'));
    }

    public function test_lookup_nama_berkas_dan_progres(): void
    {
        $this->actingAs($this->panitia());
        $v = Voter::factory()->create(['identifier' => '0071234567']);
        $t = Voter::factory()->teacher()->create();
        $this->voterWithFace(1);

        $this->postJson('/api/v1/panitia/face-templates/lookup', ['keys' => ['0071234567', 'id-'.$t->id, '9999999999']])
            ->assertOk()
            ->assertJsonPath('data.0071234567.id', $v->id)
            ->assertJsonPath('data.id-'.$t->id.'.id', $t->id)
            ->assertJsonMissingPath('data.9999999999');

        $this->getJson('/api/v1/panitia/face-templates/status')->assertJsonPath('total', 3)->assertJsonPath('registered', 1);
    }

    public function test_lookup_nama_berkas_panjang_tidak_menggagalkan_seluruh_unggahan(): void
    {
        $this->actingAs($this->panitia());
        $v = Voter::factory()->create(['identifier' => '0071234567', 'name' => 'Ahmad Fauzi', 'class_name' => 'XI IPA 1']);
        $long = 'WhatsApp Image 2026-11-12 at 10.23.45 (1) - foto pas siswa kelas sebelas';

        $this->postJson('/api/v1/panitia/face-templates/lookup', ['keys' => ['0071234567', $long, str_repeat('x', 300)]])
            ->assertOk()
            ->assertJsonPath('data.0071234567.id', $v->id)
            ->assertJsonMissingPath('data.'.$long);
    }

    public function test_lookup_mengenali_nisn_nip_di_dalam_nama_dan_nama_pemilih(): void
    {
        $this->actingAs($this->panitia());
        $a = Voter::factory()->create(['identifier' => '0071234567', 'name' => 'Ahmad Fauzi', 'class_name' => 'XI IPA 1']);
        $b = Voter::factory()->create(['identifier' => '0079876543', 'name' => 'Siti Nur\'aini', 'class_name' => 'X-3']);
        $g = Voter::factory()->teacher('198001012005011001')->create(['name' => 'Drs. Budi Santoso']);
        $t = Voter::factory()->teacher(null)->create(['name' => 'Rina Marlina']);

        $res = $this->postJson('/api/v1/panitia/face-templates/lookup', ['keys' => [
            'XI IPA 1/0071234567 - Ahmad Fauzi',
            '12. 0079876543 SITI NURAINI',
            'Guru/Budi_198001012005011001',
            '19800101 200501 1 001',
            'X-3/siti nur\'aini',
            'Guru/RINA_MARLINA',
            'Drs. Budi Santoso, S.Pd',
            'Guru/budi santoso',
            'id-'.$t->id,
            'Orang Tak Dikenal',
        ]])->assertOk();

        $this->assertSame($a->id, $res->json('data')['XI IPA 1/0071234567 - Ahmad Fauzi']['id']);
        $this->assertSame($b->id, $res->json('data')['12. 0079876543 SITI NURAINI']['id']);
        $this->assertSame($g->id, $res->json('data')['Guru/Budi_198001012005011001']['id']);
        $this->assertSame($g->id, $res->json('data')['19800101 200501 1 001']['id'], 'NIP dengan spasi');
        $this->assertSame($b->id, $res->json('data')["X-3/siti nur'aini"]['id'], 'nama, tanpa peka huruf & apostrof');
        $this->assertSame($t->id, $res->json('data')['Guru/RINA_MARLINA']['id'], 'guru tanpa NIP lewat nama');
        $this->assertSame($g->id, $res->json('data')['Drs. Budi Santoso, S.Pd']['id'], 'gelar di belakang koma diabaikan');
        $this->assertSame($g->id, $res->json('data')['Guru/budi santoso']['id'], 'gelar di depan diabaikan');
        $this->assertSame($t->id, $res->json('data')['id-'.$t->id]['id']);
        $this->assertArrayNotHasKey('Orang Tak Dikenal', $res->json('data'));
        $this->assertArrayNotHasKey('Orang Tak Dikenal', $res->json('problems'), 'tak dikenal ≠ masalah ganda');
    }

    public function test_lookup_nama_kembar_memakai_folder_kelas_atau_ditolak(): void
    {
        $this->actingAs($this->panitia());
        $x = Voter::factory()->create(['identifier' => '0071000001', 'name' => 'Muhammad Rizki', 'class_name' => 'X-1']);
        $y = Voter::factory()->create(['identifier' => '0071000002', 'name' => 'Muhammad Rizki', 'class_name' => 'XI IPS 2']);

        $res = $this->postJson('/api/v1/panitia/face-templates/lookup', ['keys' => ['X-1/Muhammad Rizki', 'xi ips 2/MUHAMMAD RIZKI', 'Semua/Muhammad Rizki', 'Muhammad Rizki']])->assertOk();

        $this->assertSame($x->id, $res->json('data')['X-1/Muhammad Rizki']['id']);
        $this->assertSame($y->id, $res->json('data')['xi ips 2/MUHAMMAD RIZKI']['id']);
        $this->assertArrayNotHasKey('Semua/Muhammad Rizki', $res->json('data'), 'tidak menebak bila kembar — mencegah wajah tertukar');
        $this->assertStringContainsString('dimiliki 2 pemilih', $res->json('problems')['Muhammad Rizki']);
    }

    public function test_lookup_hanya_pemilih_sekolah_sendiri(): void
    {
        $mine = $this->schoolSession('SMA Satu');
        $other = $this->schoolSession('SMA Dua');
        Voter::factory()->create(['election_id' => $other->id, 'identifier' => '0072222222', 'name' => 'Siswa Lain']);
        $this->actingAs($this->panitia($mine));

        $res = $this->postJson('/api/v1/panitia/face-templates/lookup', ['keys' => ['0072222222', 'Siswa Lain']])->assertOk();
        $this->assertSame([], $res->json('data'));
    }

    public function test_admin_dapat_menghapus_semua_template(): void
    {
        $this->actingAs($this->admin());
        $this->voterWithFace(1);
        $this->voterWithFace(2);

        $this->postJson('/api/v1/panitia/face-templates/purge', ['confirm' => 'salah'])->assertStatus(422);
        $this->postJson('/api/v1/panitia/face-templates/purge', ['confirm' => 'HAPUS SEMUA WAJAH'])->assertOk()->assertJsonPath('deleted', 2);
        $this->assertSame(0, FaceTemplate::count());
    }
}
