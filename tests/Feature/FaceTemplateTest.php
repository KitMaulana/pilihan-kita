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
