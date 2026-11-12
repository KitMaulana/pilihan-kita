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

    /** Panitia selalu terikat ke satu sekolah: sesi yang diberikan, sesi terbaru, atau satu sesi baru bila belum ada. */
    protected function panitia(?Election $school = null): User
    {
        $school ??= Election::query()->latest('id')->first() ?? $this->schoolSession();

        return User::factory()->create(['election_id' => $school->id]);
    }

    /** Sesi (sekolah) draf — konteks wajib untuk panel panitia multi-sekolah. */
    protected function schoolSession(string $school = 'SMAN Uji', string $status = Election::DRAFT, bool $simulation = false): Election
    {
        return Election::create(['name' => 'Pemilihan Ketua OSIS', 'school_name' => $school, 'status' => $status, 'is_simulation' => $simulation, 'settings' => Election::DEFAULT_SETTINGS]);
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
    protected function device(string $name = 'Tablet 1', string $role = KioskDevice::CHECKIN): array
    {
        // Perangkat didaftarkan ke sesi (sekolah) terbaru — sama seperti panel yang memilih sesi aktif.
        [$device, $token] = KioskDevice::register($name, null, $role, \App\Models\Election::query()->latest('id')->value('id'));

        return [$device, ['X-Device-Token' => $token, 'Accept' => 'application/json']];
    }

    /** @return array{0: KioskDevice, 1: array<string,string>} */
    protected function booth(string $name = 'Bilik 1'): array
    {
        return $this->device($name, KioskDevice::BOOTH);
    }

    /** Check-in lewat jalur cadangan NISN + tanggal lahir di meja check-in. */
    protected function checkInByNisn(array $checkinHeaders, string $nisn, string $birthDate = '2008-05-17'): void
    {
        $ticket = $this->postJson('/api/v1/kiosk/fallback', ['type' => 'student', 'identifier' => $nisn, 'birth_date' => $birthDate], $checkinHeaders)
            ->assertOk()->json('ticket');
        $this->postJson('/api/v1/kiosk/confirm', ['ticket' => $ticket, 'accepted' => true], $checkinHeaders)
            ->assertOk()->assertJsonPath('checked_in', true);
    }

    /** Memilih di bilik suara. Mengembalikan respons. */
    protected function boothVote(array $boothHeaders, int $candidateId, ?string $key = null): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/kiosk/vote', [
            'candidate_id' => $candidateId,
            'idempotency_key' => $key ?? (string) \Illuminate\Support\Str::uuid(),
        ], $boothHeaders);
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
