<?php

namespace App\Http\Middleware;

use App\Models\Election;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menentukan SESI (sekolah) yang sedang dikelola di panel panitia.
 *
 *  - Panitia yang dibatasi ke satu sesi (users.election_id) SELALU memakai sesinya sendiri;
 *    meminta sesi lain lewat header → 403.
 *  - Admin / panitia tanpa batasan: header `X-Session-Id` (dipilih di panel); bila kosong → sesi terbaru.
 *
 * Hasilnya dipakai Election::current() oleh seluruh controller/service panel.
 */
class ResolvePanitiaSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Panitia tanpa sekolah tidak boleh mengakses panel sama sekali (bukan "semua sekolah").
        if ($user && ! $user->hasSchoolAccess()) {
            return response()->json([
                'code' => 'no_school',
                'message' => 'Akun panitia Anda belum ditugaskan ke sekolah. Hubungi admin.',
            ], 403);
        }
        $requested = $request->header('X-Session-Id') ?: $request->query('session_id');
        $requested = is_numeric($requested) ? (int) $requested : null;
        $only = $user?->restrictedElectionId();

        if ($only !== null) {
            if ($requested !== null && $requested !== $only) {
                return response()->json([
                    'code' => 'session_forbidden',
                    'message' => 'Akun Anda hanya dapat mengelola sesi sekolahnya sendiri.',
                ], 403);
            }
            $election = Election::find($only);
        } elseif ($requested !== null) {
            $election = Election::find($requested) ?? Election::query()->latest('id')->first();
        } else {
            $election = Election::query()->latest('id')->first();
        }

        Election::useCurrent($election);

        return $next($request);
    }
}
