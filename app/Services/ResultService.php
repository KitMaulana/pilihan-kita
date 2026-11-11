<?php

namespace App\Services;

use App\Models\BoothCredit;
use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot "Hitung Langsung" — agregat per kandidat + partisipasi siswa/guru.
 * Di-cache 5 detik. Tidak ada rincian per kelas/jam.
 *
 * Alur check-in → bilik: perolehan menghitung SEMUA suara yang masuk, langsung (tanpa menunggu
 * segel ledger). Penyegelan batch tetap berjalan di belakang hanya untuk mengacak urutan ledger.
 * Partisipasi = jumlah pemilih yang sudah check-in; `votes_pending` = sudah check-in tetapi
 * belum memilih di bilik (antre / tidak jadi).
 */
class ResultService
{
    public const TTL = 5;

    public function snapshot(Election $election): array
    {
        return Cache::remember($this->key($election), self::TTL, fn () => $this->build($election));
    }

    public function forget(Election $election): void
    {
        Cache::forget($this->key($election));
    }

    public function build(Election $election): array
    {
        $counts = Vote::where('election_id', $election->id)
            ->select('candidate_id', DB::raw('COUNT(*) as total'))
            ->groupBy('candidate_id')
            ->pluck('total', 'candidate_id');

        $counted = (int) $counts->sum();

        $candidates = $election->candidates()->where('is_active', true)->get()->map(fn ($c) => [
            'id' => $c->id,
            'number' => $c->number,
            'name' => $c->name,
            'class_name' => $c->class_name,
            'photo_url' => $c->photoUrl(),
            'votes' => (int) ($counts[$c->id] ?? 0),
            'percent' => $counted > 0 ? round(($counts[$c->id] ?? 0) * 100 / $counted, 2) : 0,
        ])->values();

        $eligible = Voter::where('is_active', true)->where('is_simulation', (bool) $election->is_simulation)
            ->select('type', DB::raw('COUNT(*) as total'))->groupBy('type')->pluck('total', 'type');
        $voted = DB::table('voter_turnouts')
            ->join('voters', 'voters.id', '=', 'voter_turnouts.voter_id')
            ->where('voter_turnouts.election_id', $election->id)
            ->select('voters.type', DB::raw('COUNT(*) as total'))->groupBy('voters.type')->pluck('total', 'type');

        $part = fn (string $type) => [
            'voted' => (int) ($voted[$type] ?? 0),
            'total' => (int) ($eligible[$type] ?? 0),
        ];
        $students = $part(Voter::STUDENT);
        $teachers = $part(Voter::TEACHER);
        $all = ['voted' => $students['voted'] + $teachers['voted'], 'total' => $students['total'] + $teachers['total']];

        return [
            'election' => [
                'id' => $election->id,
                'name' => $election->name,
                'status' => $election->status,
                'is_simulation' => $election->is_simulation,
                'opens_at' => $election->opens_at?->toIso8601String(),
                'closes_at' => $election->closes_at?->toIso8601String(),
                'published_at' => $election->published_at?->toIso8601String(),
            ],
            'is_final' => $election->status === Election::PUBLISHED,
            'candidates' => $candidates,
            'votes_counted' => $counted,
            'votes_pending' => max(0, $all['voted'] - $counted),
            'booth_waiting' => BoothCredit::waiting($election->id)->count(),
            'participation' => ['students' => $students, 'teachers' => $teachers, 'all' => $all],
            'ledger' => [
                'count' => (int) $election->ledger_count,
                'head_hash' => $election->status === Election::PUBLISHED ? $election->ledger_head_hash : null,
            ],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function key(Election $election): string
    {
        return 'results:'.$election->id;
    }
}
