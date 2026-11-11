<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Resources\AccessAttemptResource;
use App\Models\AccessAttempt;
use App\Models\ActivityLog;
use App\Models\Election;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LogController extends Controller
{
    public function attempts(Request $request): AnonymousResourceCollection
    {
        return AccessAttemptResource::collection(
            $this->attemptQuery($request)->with(['voter', 'device'])->latest('id')
                ->paginate(min(200, max(10, (int) $request->query('per_page', 50))))
        );
    }

    public function exportAttempts(Request $request, AuditService $audit): StreamedResponse
    {
        $audit->log('logs.exported', null, ['filters' => $request->only(['method', 'result', 'device_id', 'suspicious'])]);
        $query = $this->attemptQuery($request)->with(['voter', 'device'])->orderBy('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM agar Excel membaca UTF-8
            fputcsv($out, ['waktu_wib', 'perangkat', 'metode', 'hasil', 'alasan', 'mencurigakan', 'skor', 'selisih', 'nama', 'kelas', 'nomor_induk'], ',', '"', '');
            $query->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $a) {
                    fputcsv($out, [
                        $a->created_at?->timezone('Asia/Jakarta')->format('Y-m-d H:i'),
                        $a->device?->name,
                        $a->method,
                        $a->result,
                        $a->reason,
                        $a->is_suspicious ? 'ya' : '',
                        $a->score_top,
                        $a->score_margin,
                        $a->voter?->name,
                        $a->voter?->displayClass(),
                        $a->voter?->identifier,
                    ], ',', '"', '');
                }
            });
            fclose($out);
        }, 'log-percobaan-'.now('Asia/Jakarta')->format('Ymd-Hi').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function activity(Request $request): JsonResponse
    {
        // Log sesi aktif; admin juga melihat aksi global (kelola pengguna, dsb.).
        $electionId = Election::current()?->id ?? 0;
        $logs = ActivityLog::with('user:id,name')
            ->where(fn ($q) => $request->user()->isAdmin()
                ? $q->where('election_id', $electionId)->orWhereNull('election_id')
                : $q->where('election_id', $electionId))
            ->when($request->query('action'), fn ($q, $a) => $q->where('action', 'like', $a.'%'))
            ->latest('id')->paginate(50);

        return response()->json($logs->through(fn ($l) => [
            'id' => $l->id,
            'created_at' => $l->created_at?->toIso8601String(),
            'user' => $l->user?->name,
            'action' => $l->action,
            'subject' => $l->subject_type ? $l->subject_type.' #'.$l->subject_id : null,
            'details' => $l->details,
            'ip' => $l->ip,
        ]));
    }

    private function attemptQuery(Request $request): Builder
    {
        $election = Election::current();

        return AccessAttempt::query()
            ->where('election_id', $election?->id ?? 0) // hanya sesi aktif, tidak pernah lintas sekolah
            ->when($request->query('method'), fn ($q, $m) => $q->where('method', $m))
            ->when($request->query('result'), fn ($q, $r) => $q->where('result', $r))
            ->when($request->query('device_id'), fn ($q, $d) => $q->where('device_id', $d))
            ->when($request->boolean('suspicious'), fn ($q) => $q->where('is_suspicious', true));
    }
}
