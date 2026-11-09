<?php

use App\Http\Middleware\EnsureKioskDevice;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureVotingOpen;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // SPA panitia memakai cookie sesi Sanctum (same-origin).
        $middleware->statefulApi();
        $middleware->append(SecurityHeaders::class);
        // Hostinger + Cloudflare: percayai proxy agar IP & HTTPS terdeteksi benar.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'kiosk.device' => EnsureKioskDevice::class,
            'voting.open' => EnsureVotingOpen::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        // Jangan pernah menulis vektor wajah ke log saat terjadi error validasi/exception.
        $exceptions->dontFlash(['password', 'password_confirmation', 'embedding', 'birth_date']);
    })->create();
