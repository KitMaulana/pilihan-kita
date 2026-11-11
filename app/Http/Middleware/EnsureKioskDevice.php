<?php

namespace App\Http\Middleware;

use App\Models\Election;
use App\Models\KioskDevice;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Hanya tablet terdaftar (header X-Device-Token) yang boleh memakai endpoint kiosk. */
class EnsureKioskDevice
{
    public function handle(Request $request, Closure $next): Response
    {
        $device = KioskDevice::findByToken($request->header('X-Device-Token'));

        if (! $device || ! $device->is_active) {
            return response()->json([
                'code' => 'device_unauthorized',
                'message' => 'Perangkat ini belum terdaftar atau sudah dicabut. Hubungi panitia.',
            ], 401);
        }

        // Perbarui "terakhir terlihat" paling sering tiap 30 detik (hemat tulis DB).
        if (! $device->last_seen_at || $device->last_seen_at->lt(now()->subSeconds(30))) {
            $device->forceFill(['last_seen_at' => now(), 'last_ip' => $request->ip()])->saveQuietly();
        }

        $request->attributes->set('kiosk_device', $device);
        // Tablet hanya melayani sesi (sekolah) tempat ia didaftarkan.
        Election::useCurrent($device->election);

        return $next($request);
    }
}
