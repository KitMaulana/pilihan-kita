<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_panitia_dapat_login_dan_melihat_profil(): void
    {
        $user = User::factory()->create(['email' => 'p@x.test', 'password' => 'rahasia123']);

        $this->postJson('/api/v1/auth/login', ['email' => 'p@x.test', 'password' => 'rahasia123'])
            ->assertOk()->assertJsonPath('user.email', 'p@x.test')->assertJsonPath('user.role', 'panitia');

        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_login_dengan_username(): void
    {
        User::factory()->admin()->create(['username' => 'admin', 'password' => 'adminkita']);

        $this->postJson('/api/v1/auth/login', ['login' => 'admin', 'password' => 'adminkita'])
            ->assertOk()->assertJsonPath('user.username', 'admin')->assertJsonPath('user.role', 'admin');

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->postJson('/api/v1/auth/login', ['login' => 'admin', 'password' => 'salah'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
    }

    public function test_kata_sandi_salah_ditolak(): void
    {
        User::factory()->create(['email' => 'p@x.test', 'password' => 'rahasia123']);

        $this->postJson('/api/v1/auth/login', ['email' => 'p@x.test', 'password' => 'salah'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
    }

    public function test_akun_nonaktif_tidak_bisa_login(): void
    {
        User::factory()->create(['email' => 'p@x.test', 'password' => 'rahasia123', 'is_active' => false]);

        $this->postJson('/api/v1/auth/login', ['email' => 'p@x.test', 'password' => 'rahasia123'])->assertStatus(422);
    }

    public function test_tamu_tidak_bisa_mengakses_panel(): void
    {
        $this->getJson('/api/v1/panitia/dashboard')->assertUnauthorized();
        $this->getJson('/api/v1/panitia/voters')->assertUnauthorized();
    }

    public function test_panitia_tidak_bisa_mengakses_fitur_admin(): void
    {
        $this->actingAs($this->panitia());

        $this->getJson('/api/v1/panitia/users')->assertForbidden();
        $this->postJson('/api/v1/panitia/face-templates/purge', ['confirm' => 'HAPUS SEMUA WAJAH'])->assertForbidden();
        $this->postJson('/api/v1/panitia/simulation', ['voters' => 5])->assertForbidden();
    }

    public function test_admin_dapat_membuat_akun_panitia(): void
    {
        $school = $this->schoolSession('SMAN Uji');
        $this->actingAs($this->admin());

        // Panitia WAJIB terikat ke satu sekolah.
        $this->postJson('/api/v1/panitia/users', [
            'name' => 'Panitia Baru', 'email' => 'baru@x.test', 'password' => 'katasandi1', 'role' => 'panitia',
        ])->assertStatus(422)->assertJsonValidationErrors('election_id');

        $this->postJson('/api/v1/panitia/users', [
            'name' => 'Panitia Baru', 'email' => 'baru@x.test', 'password' => 'katasandi1', 'role' => 'panitia', 'election_id' => $school->id,
        ])->assertCreated()->assertJsonPath('data.school_name', 'SMAN Uji');

        $this->assertDatabaseHas('users', ['email' => 'baru@x.test', 'role' => 'panitia', 'election_id' => $school->id]);
    }

    public function test_spa_dilayani_untuk_rute_frontend(): void
    {
        $this->withoutVite();
        $this->get('/')->assertOk()->assertSee('id="root"', false);
        $this->get('/panitia/pemilih')->assertOk();
    }
}
