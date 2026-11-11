<?php

namespace App\Services;

use App\Models\FaceTemplate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Pencocokan 1:N di server. Template TIDAK PERNAH meninggalkan server.
 *
 * Semua template aktif dimuat sebagai satu string biner (float32 LE) + daftar voter_id
 * dan di-cache. Karena vektor sudah ternormalisasi L2, cosine similarity = dot product.
 */
class FaceMatchService
{
    public const CACHE_KEY = 'face-templates:matrix';

    /**
     * @param  float[]  $probe  vektor 512 ternormalisasi
     * @return array{voter_id: ?int, s1: float, s2: float, second_voter_id: ?int, count: int, ms: float}
     */
    public function match(array $probe, ?int $excludeVoterId = null, ?int $electionId = null): array
    {
        $t0 = hrtime(true);
        $matrix = $this->matrix($electionId);
        $ids = $matrix['ids'];
        $n = count($ids);

        $bestId = null;
        $secondId = null;
        $s1 = -1.0;
        $s2 = -1.0;

        if ($n > 0) {
            $q = array_values($probe);
            $dim = FaceTemplate::DIMENSION;
            $blob = $matrix['blob'];
            $bytes = $dim * 4;
            $format = 'g'.$dim;

            for ($t = 0; $t < $n; $t++) {
                if ($ids[$t] === $excludeVoterId) {
                    continue;
                }
                // Unpack per template (offset) — lebih cepat & hemat memori daripada unpack seluruh matriks.
                $values = unpack($format, $blob, $t * $bytes); // indeks mulai 1
                $s = 0.0;
                // Loop dibuka 8x untuk mengurangi overhead interpreter.
                for ($i = 0; $i < $dim; $i += 8) {
                    $o = $i + 1;
                    $s += $q[$i] * $values[$o]
                        + $q[$i + 1] * $values[$o + 1]
                        + $q[$i + 2] * $values[$o + 2]
                        + $q[$i + 3] * $values[$o + 3]
                        + $q[$i + 4] * $values[$o + 4]
                        + $q[$i + 5] * $values[$o + 5]
                        + $q[$i + 6] * $values[$o + 6]
                        + $q[$i + 7] * $values[$o + 7];
                }
                if ($s > $s1) {
                    $s2 = $s1;
                    $secondId = $bestId;
                    $s1 = $s;
                    $bestId = $ids[$t];
                } elseif ($s > $s2) {
                    $s2 = $s;
                    $secondId = $ids[$t];
                }
            }
        }

        return [
            'voter_id' => $bestId,
            's1' => $bestId === null ? 0.0 : $s1,
            's2' => $secondId === null ? 0.0 : $s2,
            'second_voter_id' => $secondId,
            'count' => $n,
            'ms' => (hrtime(true) - $t0) / 1e6,
        ];
    }

    /**
     * Aturan keputusan §6.3: cocok bila s1 >= ambang DAN s1 - s2 >= margin.
     */
    public function decide(array $result, float $threshold, float $margin): string
    {
        if ($result['voter_id'] === null || $result['s1'] < $threshold) {
            return 'not_matched';
        }
        if (($result['s1'] - $result['s2']) < $margin) {
            return 'ambiguous';
        }

        return 'matched';
    }

    /**
     * Matriks template aktif. Multi-sekolah: $electionId membatasi ke pemilih satu sesi
     * (pencocokan 1:N hanya terhadap sekolah yang sama); null = semua sesi (alat benchmark).
     *
     * @return array{ids: int[], blob: string}
     */
    public function matrix(?int $electionId = null): array
    {
        return Cache::rememberForever($this->cacheKey($electionId), function () use ($electionId) {
            $ids = [];
            $blob = '';
            DB::table('face_templates')
                ->join('voters', 'voters.id', '=', 'face_templates.voter_id')
                ->where('voters.is_active', true)
                ->when($electionId !== null, fn ($q) => $q->where('voters.election_id', $electionId))
                ->orderBy('face_templates.voter_id')
                ->select('face_templates.voter_id', 'face_templates.embedding')
                ->chunk(500, function ($rows) use (&$ids, &$blob) {
                    foreach ($rows as $row) {
                        if (strlen($row->embedding) !== FaceTemplate::DIMENSION * 4) {
                            continue;
                        }
                        $ids[] = (int) $row->voter_id;
                        $blob .= $row->embedding;
                    }
                });

            return ['ids' => $ids, 'blob' => $blob];
        });
    }

    /** Kunci cache berversi: flush() cukup menaikkan versi sehingga cache semua sesi langsung basi. */
    public function cacheKey(?int $electionId = null): string
    {
        $version = (int) Cache::get(self::CACHE_KEY.':version', 1);

        return self::CACHE_KEY.':v'.$version.':'.($electionId === null ? 'all' : 'e'.$electionId);
    }

    public function flush(): void
    {
        Cache::forever(self::CACHE_KEY.':version', (int) Cache::get(self::CACHE_KEY.':version', 1) + 1);
    }

    /**
     * Validasi vektor masuk: dimensi 512, angka hingga, norma ≈ 1.
     * Mengembalikan vektor yang sudah dinormalisasi ulang, atau null bila tidak valid.
     *
     * @return float[]|null
     */
    public static function sanitize(mixed $vector): ?array
    {
        if (! is_array($vector) || count($vector) !== FaceTemplate::DIMENSION) {
            return null;
        }
        $out = [];
        $sum = 0.0;
        foreach (array_values($vector) as $v) {
            if (! is_int($v) && ! is_float($v)) {
                return null;
            }
            $v = (float) $v;
            if (! is_finite($v)) {
                return null;
            }
            $out[] = $v;
            $sum += $v * $v;
        }
        $norm = sqrt($sum);
        if ($norm < 0.98 || $norm > 1.02) {
            return null;
        }

        return array_map(fn ($v) => $v / $norm, $out);
    }
}
