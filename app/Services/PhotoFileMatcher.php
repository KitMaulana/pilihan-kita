<?php

namespace App\Services;

use App\Models\Voter;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Mencocokkan nama berkas pas foto dengan pemilih satu sekolah, sebelum foto diproses di peramban.
 *
 * Kunci = jalur relatif tanpa ekstensi, mis. "XI IPA 1/0071234567 - Ahmad Fauzi". Urutan aturan:
 *  1. "id-123"                               → ID pemilih (guru tanpa NIP)
 *  2. nama berkas = NISN/NIP (spasi, titik, minus, garis bawah diabaikan)
 *  3. ada deret angka di nama berkas yang sama dengan NISN/NIP, mis. "Ahmad_0071234567", "12. 0071234567 Ahmad"
 *  4. nama berkas = nama pemilih (huruf besar/kecil, tanda baca, gelar di belakang koma diabaikan);
 *     bila nama sama dimiliki >1 pemilih, nama folder dipakai sebagai petunjuk kelas.
 *     Masih ganda → TIDAK dicocokkan (mencegah wajah tertukar), diberi alasan.
 *
 * Tidak pernah melempar galat karena satu nama berkas aneh: kunci yang tak cocok hanya diberi alasan.
 */
class PhotoFileMatcher
{
    /**
     * @param  array<int, string>  $keys
     * @return array{data: array<string, array>, problems: array<string, string>}
     */
    public function match(array $keys, int $electionId): array
    {
        $voters = Voter::query()
            ->where('election_id', $electionId)
            ->withExists('faceTemplate as has_face')
            ->get(['id', 'type', 'identifier', 'name', 'class_name']);

        $byId = $voters->keyBy('id');
        $byIdentifier = $voters->filter(fn ($v) => $v->identifier)->keyBy(fn ($v) => $this->compact($v->identifier));
        $byName = $voters->groupBy(fn ($v) => $this->normName($v->name));

        $data = [];
        $problems = [];
        foreach (array_unique($keys) as $key) {
            [$voter, $problem] = $this->resolve((string) $key, $byId, $byIdentifier, $byName);
            if ($voter) {
                $data[$key] = [
                    'id' => $voter->id,
                    'name' => $voter->name,
                    'class_name' => $voter->displayClass(),
                    'has_face' => (bool) $voter->has_face,
                ];
            } elseif ($problem) {
                $problems[$key] = $problem;
            }
        }

        return ['data' => $data, 'problems' => $problems];
    }

    /** @return array{0: ?Voter, 1: ?string} */
    private function resolve(string $key, Collection $byId, Collection $byIdentifier, Collection $byName): array
    {
        $parts = preg_split('#[\\\\/]+#', trim($key), -1, PREG_SPLIT_NO_EMPTY) ?: [''];
        $base = trim((string) array_pop($parts));
        $folder = (string) end($parts);

        // 1. id-123
        if (preg_match('/^id[-_ ]?(\d+)$/i', $base, $m)) {
            return [$byId->get((int) $m[1]), null];
        }

        // 2. NISN/NIP utuh.
        $compact = $this->compact($base);
        if ($compact !== '' && $byIdentifier->has($compact)) {
            return [$byIdentifier->get($compact), null];
        }

        // 3. Deret angka di dalam nama berkas (≥ 5 digit; titik/spasi di tengah NIP diabaikan).
        preg_match_all('/\d[\d .\-]{3,}\d/', $base, $runs);
        $hits = collect($runs[0])->map(fn ($r) => $this->compact($r))->filter(fn ($r) => $byIdentifier->has($r))->unique();
        if ($hits->count() === 1) {
            return [$byIdentifier->get($hits->first()), null];
        }
        if ($hits->count() > 1) {
            return [null, 'Nama berkas memuat lebih dari satu NISN/NIP'];
        }

        // 4. Nama pemilih.
        $name = $this->normName(preg_replace('/\d+/', ' ', $base));
        if ($name === '' || ! $byName->has($name)) {
            return [null, null];
        }
        $candidates = $byName->get($name);
        if ($candidates->count() === 1) {
            return [$candidates->first(), null];
        }
        if ($folder !== '') {
            $inClass = $candidates->filter(fn ($v) => $v->class_name && $this->compact($v->class_name) === $this->compact($folder));
            if ($inClass->count() === 1) {
                return [$inClass->first(), null];
            }
        }

        return [null, 'Nama "'.Str::limit($base, 60).'" dimiliki '.$candidates->count().' pemilih. Ganti nama berkas dengan NISN/NIP-nya'];
    }

    /** "0071 234.567" → "0071234567"; "XI IPA-1" → "XIIPA1". */
    private function compact(string $s): string
    {
        return strtoupper(preg_replace('/[\s.\-_]+/u', '', $s));
    }

    /** "Drs. Budi Santoso, S.Pd" → "BUDI SANTOSO"; "AHMAD_FAUZI" → "AHMAD FAUZI". */
    private function normName(string $s): string
    {
        $s = explode(',', $s)[0]; // gelar di belakang koma
        $s = Str::ascii($s);
        $s = preg_replace('/[^A-Za-z\' ]+/', ' ', str_replace(['_', '.', '-'], ' ', $s));
        $s = str_replace("'", '', $s);

        $s = strtoupper(trim(preg_replace('/\s+/', ' ', $s)));

        // Gelar di depan nama ("Drs. Budi", "Hj. Siti") diabaikan di kedua sisi.
        return preg_replace('/^(?:(?:PROF|DRS|DRA|DR|IR|HJ|H|KH|USTADZ|USTADZAH)\s+)+(?=\S)/', '', $s);
    }
}
