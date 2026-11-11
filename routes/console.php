<?php

use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\User;
use App\Services\ElectionService;
use App\Services\FaceMatchService;
use App\Services\FaceTemplateService;
use App\Services\LedgerService;
use App\Services\SimulationService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Ledger
|--------------------------------------------------------------------------
*/
Artisan::command('votes:verify-ledger {--election= : ID pemilihan (bawaan: terbaru)}', function (LedgerService $ledger) {
    $election = $this->option('election') ? Election::findOrFail($this->option('election')) : Election::current();
    if (! $election) {
        $this->error('Belum ada pemilihan.');

        return 1;
    }

    $r = $ledger->verify($election);
    $this->table(['Item', 'Nilai'], [
        ['Pemilihan', "#{$election->id} {$election->name} ({$election->status})"],
        ['Suara tersegel', $r['sealed']],
        ['Suara menunggu segel', $r['pending']],
        ['Total suara', $r['votes']],
        ['Total penanda sudah memilih', $r['turnout']],
        ['Hash terakhir', $r['head'] ?? '-'],
    ]);

    if ($r['ok']) {
        $this->info('✔ Ledger VALID.');

        return 0;
    }
    foreach ($r['errors'] as $e) {
        $this->error('✘ '.$e);
    }

    return 1;
})->purpose('Verifikasi rantai hash ledger suara');

Artisan::command('votes:seal {--force : Segel semua suara tertunda walau belum satu batch}', function (LedgerService $ledger) {
    // Semua sesi yang masih punya suara menunggu segel.
    $n = 0;
    foreach (Election::whereIn('status', [Election::OPEN, Election::CLOSED])->get() as $election) {
        $n += $ledger->seal($election, (bool) $this->option('force'));
    }
    $this->info("{$n} suara disegel.");
})->purpose('Segel suara tertunda ke ledger');

/*
|--------------------------------------------------------------------------
| Wajah
|--------------------------------------------------------------------------
*/
Artisan::command('face:benchmark {--n=1800 : Jumlah template sintetis} {--runs=10}', function () {
    $n = (int) $this->option('n');
    $runs = (int) $this->option('runs');
    $this->info("Membuat {$n} template sintetis di memori…");

    $ids = [];
    $blob = '';
    for ($i = 1; $i <= $n; $i++) {
        $ids[] = $i;
        $blob .= FaceTemplate::pack(SimulationService::randomUnitVector());
    }
    $svc = app(FaceMatchService::class);
    $key = $svc->cacheKey(null);
    $previous = Cache::get($key);
    Cache::forever($key, ['ids' => $ids, 'blob' => $blob]);

    $probe = SimulationService::randomUnitVector();
    $times = [];
    for ($r = 0; $r < $runs; $r++) {
        $t0 = hrtime(true);
        $svc->match($probe, null, null);
        $times[] = (hrtime(true) - $t0) / 1e6;
    }

    $previous ? Cache::forever($key, $previous) : Cache::forget($key);

    sort($times);
    $this->table(['Template', 'Run', 'Min (ms)', 'Median (ms)', 'Maks (ms)', 'Memori puncak (MB)'], [[
        $n, $runs, round($times[0], 1), round($times[intdiv(count($times), 2)], 1), round(end($times), 1),
        round(memory_get_peak_usage(true) / 1048576, 1),
    ]]);
    $this->comment('Termasuk baca cache + unpack + perkalian titik. Target < 200 ms.');
})->purpose('Ukur waktu pencocokan 1:N di server');

Artisan::command('face:purge-all {--force}', function (FaceTemplateService $svc) {
    if (! $this->option('force') && ! $this->confirm('Hapus PERMANEN semua template wajah?')) {
        return 1;
    }
    $n = $svc->purgeAll();
    $this->info("{$n} template wajah dihapus.");
})->purpose('Hapus semua template wajah (retensi pasca-pemilihan)');

/*
|--------------------------------------------------------------------------
| Simulasi
|--------------------------------------------------------------------------
*/
Artisan::command('simulation:create {--voters=200} {--candidates=3} {--export= : Simpan vektor ke file JSON (untuk skrip uji beban)}', function (SimulationService $sim) {
    $r = $sim->create((int) $this->option('voters'), (int) $this->option('candidates'), withFaces: true);
    $this->info("Simulasi #{$r['election']->id} dibuat dengan {$r['voters']} pemilih palsu ber-template acak.");

    if ($path = $this->option('export')) {
        file_put_contents($path, json_encode(['voters' => $r['embeddings']]));
        $this->warn("Vektor simulasi ditulis ke {$path} — JANGAN di-commit.");
    }
})->purpose('Buat pemilihan simulasi + pemilih palsu');

Artisan::command('simulation:purge {--force}', function (SimulationService $sim) {
    if (! $this->option('force') && ! $this->confirm('Hapus semua data simulasi?')) {
        return 1;
    }
    $this->table(['Item', 'Dihapus'], collect($sim->purge())->map(fn ($v, $k) => [$k, $v])->values()->all());
})->purpose('Hapus bersih semua data simulasi');

/*
|--------------------------------------------------------------------------
| Akun & jadwal
|--------------------------------------------------------------------------
*/
Artisan::command('panitia:create-admin {email} {name=Administrator}', function (string $email, string $name) {
    $password = $this->secret('Kata sandi (min. 8 karakter)');
    if (! $password || strlen($password) < 8) {
        $this->error('Kata sandi minimal 8 karakter.');

        return 1;
    }
    User::updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password, 'role' => User::ROLE_ADMIN, 'is_active' => true]);
    $this->info("Admin {$email} siap.");
})->purpose('Buat/ubah akun admin');

Artisan::command('election:auto-close', function (ElectionService $svc) {
    foreach ($svc->autoClose() as $closed) {
        $this->info("Sesi #{$closed->id} ({$closed->label()}) ditutup otomatis.");
    }
})->purpose('Tutup otomatis bila jam tutup terlewati');

Artisan::command('kiosk:prune-tickets', function () {
    $n = DB::table('ballot_tickets')->where('expires_at', '<', now())->delete();
    $this->info("{$n} tiket kedaluwarsa dihapus.");
})->purpose('Hapus tiket sesi kiosk yang kedaluwarsa');

Schedule::command('election:auto-close')->everyMinute()->withoutOverlapping();
Schedule::command('kiosk:prune-tickets')->everyFiveMinutes();
Schedule::command('votes:seal')->everyFiveMinutes(); // hanya menyegel bila sudah satu batch penuh
