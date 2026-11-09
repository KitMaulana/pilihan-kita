<?php

namespace Tests\Feature;

use App\Models\FaceTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_header_keamanan_terpasang_dan_api_tidak_di_cache(): void
    {
        $this->openElection();
        [, $h] = $this->device();

        $this->getJson('/api/v1/kiosk/status', $h)->assertOk()
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_auth_me_untuk_tamu_mengembalikan_null_bukan_401(): void
    {
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('user', null);
    }

    public function test_vektor_wajah_tidak_tertulis_ke_log_saat_galat(): void
    {
        $log = storage_path('logs/laravel.log');
        $before = File::exists($log) ? File::size($log) : 0;

        $this->openElection();
        [, $h] = $this->device();
        $marker = 0.0123456789;
        $vec = array_fill(0, FaceTemplate::DIMENSION, $marker);

        $this->postJson('/api/v1/kiosk/identify', $this->identifyPayload($vec), $h)->assertStatus(422);

        $appended = File::exists($log) ? substr((string) File::get($log), $before) : '';
        $this->assertStringNotContainsString('0.0123456789', $appended);
    }

    public function test_respons_publik_tidak_memuat_data_pribadi(): void
    {
        $this->openElection();
        $this->voterWithFace(1, ['name' => 'Rahasia Sekali', 'identifier' => '0079999999']);

        $body = $this->getJson('/api/v1/public/results')->assertOk()->getContent();
        $this->assertStringNotContainsString('Rahasia Sekali', $body);
        $this->assertStringNotContainsString('0079999999', $body);
    }
}
