<?php

namespace App\Http\Middleware;

use App\Models\Election;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Membersihkan sesi aktif di awal setiap request API agar tidak terbawa dari request sebelumnya. */
class ResetCurrentElection
{
    public function handle(Request $request, Closure $next): Response
    {
        Election::forgetCurrent();

        return $next($request);
    }
}
