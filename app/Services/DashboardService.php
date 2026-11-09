<?php

namespace App\Services;

use App\Models\AccessAttempt;
use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\KioskDevice;
use App\Models\Voter;
use Illuminate\Support\Facades\DB;

/** Ringkasan panel panitia + indikator anomali. */
class DashboardService
{
    public function __construct(private ResultService $results) {}

    public function summary(?Election $election): array
    {
        $sim = (bool) $election?->is_simulation;
        $voters = Voter::where('is_simulation', $sim);

        $totalVoters = (clone $voters)->where('is_active', true)->count();
        $withFace = FaceTemplate::whereIn('voter_id', (clone $voters)->where('is_active', true)->select('id'))->count();

        return [
            'election' => $election ? [
                'id' => $election->id,
                'name' => $election->name,
                'status' => $election->status,
                'is_simulation' => $election->is_simulation,
                'is_voting_open' => $election->isVotingOpen(),
                'opens_at' => $election->opens_at?->toIso8601String(),
                'closes_at' => $election->closes_at?->toIso8601String(),
            ] : null,
            'voters' => [
                'total' => $totalVoters,
                'with_face' => $withFace,
                'face_percent' => $totalVoters ? round($withFace * 100 / $totalVoters, 1) : 0,
                'locked' => (clone $voters)->whereNotNull('locked_at')->count(),
                'duplicates_flagged' => FaceTemplate::whereNotNull('duplicate_of_voter_id')->count(),
            ],
            'results' => $election ? $this->results->snapshot($election) : null,
            'devices' => $this->devices(),
            'anomalies' => $election ? $this->anomalies($election) : [],
        ];
    }

    public function devices(): array
    {
        return KioskDevice::orderBy('name')->get()->map(fn ($d) => [
            'id' => $d->id,
            'name' => $d->name,
            'is_active' => $d->is_active,
            'online' => $d->is_active && $d->last_seen_at && $d->last_seen_at->gt(now()->subMinutes(2)),
            'last_seen_at' => $d->last_seen_at?->toIso8601String(),
        ])->all();
    }

    /**
     * Indikator anomali (jendela 30 menit terakhir):
     *  - percobaan gagal beruntun di satu tablet
     *  - porsi cadangan tinggi di satu tablet
     *  - liveness gagal
     *  - pemilih menolak konfirmasi nama (kemungkinan salah-kenal)
     *  - pemilih terkunci
     */
    public function anomalies(Election $election): array
    {
        $since = now()->subMinutes(30);
        $items = [];

        $perDevice = AccessAttempt::where('election_id', $election->id)->where('created_at', '>=', $since)
            ->select('device_id',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN method = 'fallback' THEN 1 ELSE 0 END) as fallback"),
                DB::raw("SUM(CASE WHEN result IN ('wrong_data','locked','not_matched','ambiguous') THEN 1 ELSE 0 END) as failed"),
                DB::raw("SUM(CASE WHEN result = 'liveness_failed' THEN 1 ELSE 0 END) as liveness"),
                DB::raw("SUM(CASE WHEN result = 'rejected' AND method = 'face' THEN 1 ELSE 0 END) as rejected"))
            ->groupBy('device_id')->get();

        $names = KioskDevice::pluck('name', 'id');

        foreach ($perDevice as $row) {
            $name = $names[$row->device_id] ?? 'Perangkat tidak dikenal';
            if ($row->failed >= 5) {
                $items[] = ['level' => 'warning', 'type' => 'failed_attempts', 'message' => "{$name}: {$row->failed} percobaan gagal dalam 30 menit."];
            }
            if ($row->total >= 10 && $row->fallback / max(1, $row->total) >= 0.5) {
                $pct = round($row->fallback * 100 / $row->total);
                $items[] = ['level' => 'warning', 'type' => 'fallback_heavy', 'message' => "{$name}: {$pct}% akses memakai jalur cadangan. Periksa pencahayaan/kamera atau kemungkinan penyalahgunaan."];
            }
            if ($row->liveness >= 3) {
                $items[] = ['level' => 'danger', 'type' => 'liveness', 'message' => "{$name}: {$row->liveness} kali liveness gagal. Kemungkinan percobaan memakai foto/layar."];
            }
            if ($row->rejected >= 2) {
                $items[] = ['level' => 'warning', 'type' => 'rejected', 'message' => "{$name}: {$row->rejected} pemilih menolak nama hasil pengenalan wajah. Pertimbangkan menaikkan ambang."];
            }
        }

        // Percobaan gagal beruntun (5 terakhir di satu perangkat semuanya gagal).
        foreach ($names as $id => $name) {
            $last = AccessAttempt::where('device_id', $id)->where('election_id', $election->id)
                ->where('created_at', '>=', $since)->latest('id')->limit(5)->pluck('result');
            if ($last->count() === 5 && $last->every(fn ($r) => in_array($r, ['wrong_data', 'locked', 'liveness_failed'], true))) {
                $items[] = ['level' => 'danger', 'type' => 'streak', 'message' => "{$name}: 5 percobaan terakhir berturut-turut gagal."];
            }
        }

        $locked = Voter::where('is_simulation', (bool) $election->is_simulation)->whereNotNull('locked_at')->count();
        if ($locked > 0) {
            $items[] = ['level' => 'info', 'type' => 'locked', 'message' => "{$locked} pemilih terkunci menunggu buka-kunci panitia."];
        }

        return $items;
    }
}
