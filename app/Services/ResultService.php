<?php

namespace App\Services;

use App\Models\Election;
use App\Models\Vote;
use App\Models\Voter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot "Hitung Langsung" — agregat per kandidat + partisipasi siswa/guru.
 * Di-cache 5 detik. Tidak ada rincian per kelas/jam.
 *
 * Selama voting, perolehan dihitung dari suara yang SUDAH DISEGEL (per kelompok
 * `seal_batch_size`), agar penonton tidak bisa menebak pilihan seseorang dengan
 * mengamati angka yang naik satu per satu tepat setelah orang itu memilih.
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
        $final = in_array($election->status, [Election::CLOSED, Election::PUBLISHED], true);

        $counts = Vote::where('election_id', $election->id)
            ->when(! $final, fn ($q) => $q->whereNotNull('seq'))
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
            'seal_batch_size' => (int) $election->setting('seal_batch_size'),
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
