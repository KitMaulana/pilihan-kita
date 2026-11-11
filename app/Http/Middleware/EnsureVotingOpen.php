<?php

namespace App\Http\Middleware;

use App\Models\Election;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Endpoint pemungutan hanya bisa dipakai saat status `open` dan di dalam jendela waktu. */
class EnsureVotingOpen
{
    public function handle(Request $request, Closure $next): Response
    {
        $election = Election::current();

        if (! $election || ! $election->isVotingOpen()) {
            return response()->json([
                'code' => 'voting_closed',
                'message' => $election?->votingClosedReason() ?? 'Perangkat ini belum terhubung ke sesi pemilihan. Hubungi panitia.',
            ], 403);
        }

        $request->attributes->set('election', $election);

        return $next($request);
    }
}
