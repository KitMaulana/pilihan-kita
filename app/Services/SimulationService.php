<?php

namespace App\Services;

use App\Models\AccessAttempt;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\Voter;
use Illuminate\Support\Facades\DB;

/**
 * Mode simulasi (gladi bersih / uji beban): pemilihan + pemilih + template palsu yang
 * ditandai `is_simulation` dan bisa dihapus bersih tanpa menyentuh data nyata.
 */
class SimulationService
{
    public function __construct(private FaceMatchService $matcher, private AuditService $audit) {}

    /**
     * @return array{election: Election, voters: int, embeddings: array<int, array{identifier: string, birth_date: string, embedding: float[]}>}
     */
    public function create(int $voters = 50, int $candidates = 3, bool $withFaces = true, int $minutes = 120): array
    {
        $election = DB::transaction(function () use ($candidates, $minutes) {
            $election = Election::create([
                'name' => 'SIMULASI Pemilihan Ketua OSIS',
                'status' => Election::OPEN,
                'opens_at' => now()->subMinute(),
                'closes_at' => now()->addMinutes($minutes),
                'is_simulation' => true,
                'settings' => Election::DEFAULT_SETTINGS,
            ]);
            $names = ['Pasangan Merah', 'Pasangan Biru', 'Pasangan Hijau', 'Pasangan Kuning', 'Pasangan Ungu'];
            for ($i = 1; $i <= $candidates; $i++) {
                Candidate::create([
                    'election_id' => $election->id,
                    'number' => $i,
                    'name' => $names[$i - 1] ?? "Kandidat {$i}",
                    'class_name' => 'XI',
                    'vision' => 'Visi simulasi.',
                    'mission' => 'Misi simulasi.',
                ]);
            }

            return $election;
        });

        $exported = [];
        $base = Voter::where('is_simulation', true)->count();
        for ($i = 1; $i <= $voters; $i++) {
            $n = $base + $i;
            $isTeacher = $i % 20 === 0;
            $voter = Voter::create([
                'type' => $isTeacher ? Voter::TEACHER : Voter::STUDENT,
                'identifier' => $isTeacher ? '1999'.str_pad((string) $n, 14, '0', STR_PAD_LEFT) : '99'.str_pad((string) $n, 8, '0', STR_PAD_LEFT),
                'name' => ($isTeacher ? 'Guru Simulasi ' : 'Siswa Simulasi ').$n,
                'class_name' => $isTeacher ? null : 'SIM-'.(($n % 10) + 1),
                'birth_date' => '2008-01-01',
                'is_simulation' => true,
            ]);

            if ($withFaces) {
                $vec = self::randomUnitVector();
                FaceTemplate::create([
                    'voter_id' => $voter->id,
                    'embedding' => FaceTemplate::pack($vec),
                    'model_version' => 'simulation',
                    'quality_score' => 1.0,
                ]);
                $exported[] = ['identifier' => $voter->identifier, 'type' => $voter->type, 'birth_date' => '2008-01-01', 'embedding' => $vec];
            }
        }

        $this->matcher->flush();
        $this->audit->log('simulation.created', $election, ['voters' => $voters]);

        return ['election' => $election, 'voters' => $voters, 'embeddings' => $exported];
    }

    /** Hapus SEMUA data simulasi. Data nyata tidak disentuh. */
    public function purge(): array
    {
        $result = DB::transaction(function () {
            $electionIds = Election::where('is_simulation', true)->pluck('id');
            $voterIds = Voter::where('is_simulation', true)->pluck('id');

            $attempts = AccessAttempt::whereIn('election_id', $electionIds)->orWhereIn('voter_id', $voterIds)->delete();
            DB::table('voter_turnouts')->whereIn('election_id', $electionIds)->delete();
            DB::table('ballot_tickets')->whereIn('election_id', $electionIds)->delete();
            $votes = DB::table('votes')->whereIn('election_id', $electionIds)->delete();
            Candidate::whereIn('election_id', $electionIds)->delete();
            $elections = Election::whereIn('id', $electionIds)->delete();
            FaceTemplate::whereIn('voter_id', $voterIds)->delete();
            $voters = Voter::whereIn('id', $voterIds)->delete();

            return compact('elections', 'voters', 'votes', 'attempts');
        });

        $this->matcher->flush();
        $this->audit->log('simulation.purged', null, $result);

        return $result;
    }

    /** @return float[] */
    public static function randomUnitVector(int $dim = FaceTemplate::DIMENSION): array
    {
        $v = [];
        $sum = 0.0;
        for ($i = 0; $i < $dim; $i++) {
            // Box–Muller → distribusi normal → arah acak seragam di bola satuan.
            $u1 = max(mt_rand() / mt_getrandmax(), 1e-12);
            $u2 = mt_rand() / mt_getrandmax();
            $x = sqrt(-2 * log($u1)) * cos(2 * M_PI * $u2);
            $v[] = $x;
            $sum += $x * $x;
        }
        $norm = sqrt($sum);

        return array_map(fn ($x) => $x / $norm, $v);
    }
}
