<?php

namespace Tests;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\KioskDevice;
use App\Models\User;
use App\Models\Voter;
use App\Services\FaceMatchService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected const MODEL = 'buffalo_s/w600k_mbf';

    protected function setUp(): void
    {
        parent::setUp();

        // Pengaman: RefreshDatabase akan MENGHAPUS isi database. Tolak bila bukan SQLite in-memory
        // (mis. karena `php artisan config:cache` aktif sehingga phpunit.xml diabaikan).
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:') {
            fwrite(STDERR, "\nTES DIHENTIKAN: koneksi DB bukan sqlite :memory:. Jalankan `php artisan config:clear` dulu.\n");
            exit(1);
        }
    }

    protected function admin(): User
    {
        return User::factory()->admin()->create();
    }

    protected function panitia(): User
    {
        return User::factory()->create();
    }

    protected function openElection(array $settings = [], int $candidates = 2): Election
    {
        $election = Election::create([
            'name' => 'Uji',
            'status' => Election::OPEN,
            'opens_at' => now()->subHour(),
            'closes_at' => now()->addHour(),
            'settings' => array_merge(Election::DEFAULT_SETTINGS, $settings),
        ]);
        for ($i = 1; $i <= $candidates; $i++) {
            Candidate::create(['election_id' => $election->id, 'number' => $i, 'name' => "Kandidat {$i}"]);
        }

        return $election;
    }

    /** @return array{0: KioskDevice, 1: array<string,string>} */
    protected function device(string $name = 'Tablet 1'): array
    {
        [$device, $token] = KioskDevice::register($name);

        return [$device, ['X-Device-Token' => $token, 'Accept' => 'application/json']];
    }

    /** Vektor satuan berarah sumbu-i (+ campuran kecil sumbu lain bila diberikan). */
    protected function vec(int $axis, array $mix = []): array
    {
        $v = array_fill(0, FaceTemplate::DIMENSION, 0.0);
        $v[$axis] = 1.0;
        foreach ($mix as $ax => $w) {
            $v[$ax] += $w;
        }
        $norm = sqrt(array_sum(array_map(fn ($x) => $x * $x, $v)));

        return array_map(fn ($x) => $x / $norm, $v);
    }

    protected function voterWithFace(int $axis, array $attrs = []): Voter
    {
        $voter = Voter::factory()->create($attrs);
        FaceTemplate::create([
            'voter_id' => $voter->id,
            'embedding' => FaceTemplate::pack($this->vec($axis)),
            'model_version' => self::MODEL,
        ]);
        app(FaceMatchService::class)->flush();

        return $voter;
    }

    protected function identifyPayload(array $embedding, bool $liveness = true): array
    {
        return [
            'embedding' => $embedding,
            'model_version' => self::MODEL,
            'liveness' => ['passed' => $liveness, 'challenges' => ['blink', 'turn_left']],
        ];
    }
}
