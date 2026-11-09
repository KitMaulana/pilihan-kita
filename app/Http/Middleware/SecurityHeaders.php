<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $h = $response->headers;

        $h->set('X-Content-Type-Options', 'nosniff');
        $h->set('X-Frame-Options', 'DENY');
        $h->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $h->set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
        $h->set('Cross-Origin-Opener-Policy', 'same-origin');

        if ($request->isSecure()) {
            $h->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // CSP hanya di produksi (Vite dev server memakai origin lain).
        // 'wasm-unsafe-eval' dibutuhkan ONNX Runtime Web & MediaPipe.
        if (config('app.env') === 'production' && config('security.csp', true)) {
            $h->set('Content-Security-Policy', implode('; ', [
                "default-src 'self'",
                "script-src 'self' 'wasm-unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "media-src 'self' blob:",
                "connect-src 'self'",
                "worker-src 'self' blob:",
                "font-src 'self' data:",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ]));
        }

        // API tidak boleh di-cache browser/service worker, kecuali yang mengatur sendiri (hasil publik).
        if ($request->is('api/*') && ! str_contains((string) $h->get('Cache-Control'), 'public')) {
            $h->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }
}
