<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Memisahkan peran perangkat: meja check-in tidak bisa memungut suara,
 * bilik suara tidak bisa mengidentifikasi pemilih. Dipasang setelah kiosk.device.
 */
class EnsureKioskRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $device = $request->attributes->get('kiosk_device');

        if (! $device || $device->role !== $role) {
            return response()->json([
                'code' => 'wrong_device_role',
                'message' => $role === 'booth'
                    ? 'Perangkat ini terdaftar sebagai meja check-in, bukan bilik suara.'
                    : 'Perangkat ini terdaftar sebagai bilik suara, bukan meja check-in.',
            ], 403);
        }

        return $next($request);
    }
}
