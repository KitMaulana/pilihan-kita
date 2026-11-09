<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Kunci dari header token (bukan atribut request): middleware throttle berprioritas lebih tinggi
        // sehingga bisa berjalan SEBELUM middleware kiosk.device.
        $byDevice = fn (Request $r) => $r->header('X-Device-Token')
            ? 'dev:'.hash('sha256', (string) $r->header('X-Device-Token'))
            : 'ip:'.$r->ip();
        $tooMany = fn () => response()->json([
            'code' => 'rate_limited',
            'message' => 'Terlalu banyak permintaan dari perangkat ini. Tunggu sebentar lalu coba lagi.',
        ], 429);

        foreach (config('security.kiosk_rate') as $name => $perMinute) {
            RateLimiter::for('kiosk-'.$name, fn (Request $r) => Limit::perMinute($perMinute)->by($byDevice($r))->response($tooMany));
        }

        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(5)->by(strtolower((string) ($r->input('login') ?: $r->input('email'))).'|'.$r->ip()),
            Limit::perMinute(20)->by($r->ip()),
        ]);

        // Banyak penonton bisa berbagi satu IP (NAT wifi sekolah) → longgar; hasil sudah di-cache.
        RateLimiter::for('public', fn (Request $r) => Limit::perMinute(1200)->by($r->ip()));
        RateLimiter::for('receipt', fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
        RateLimiter::for('panitia', fn (Request $r) => Limit::perMinute(300)->by($r->user()?->id ?: $r->ip()));
    }
}
