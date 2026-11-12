<?php

namespace App\Services;

use App\Models\BoothCredit;
use App\Models\Election;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

/**
 * Ledger berantai hash dengan PENYEGELAN BATCH ACAK.
 *
 * Suara baru masuk dengan seq/hash kosong ("menunggu segel"). Setiap kali jumlahnya mencapai
 * `seal_batch_size`, seluruh suara tertunda diacak (CSPRNG) lalu dirantai:
 *     hash = sha256(prev_hash | candidate_id | receipt_code | nonce)
 * Dengan begitu urutan ledger TIDAK mencerminkan urutan kedatangan pemilih, sehingga log
 * percobaan akses (yang memuat voter_id + menit) tidak bisa dikorelasikan dengan isi suara.
 * Saat pemilihan ditutup, sisa suara disegel paksa.
 */
class LedgerService
{
    public static function genesis(Election $election): string
    {
        return hash('sha256', 'PILIHAN-KITA|genesis|'.$election->id);
    }

    public static function link(string $prev, int $candidateId, string $receipt, string $nonce): string
    {
        return hash('sha256', implode('|', [$prev, $candidateId, $receipt, $nonce]));
    }

    /** @return int jumlah suara yang disegel */
    public function seal(Election $election, bool $force = false): int
    {
        return DB::transaction(function () use ($election, $force) {
            $locked = Election::whereKey($election->id)->lockForUpdate()->first();
            $pending = Vote::where('election_id', $election->id)->whereNull('seq')->lockForUpdate()->get();

            $batch = max(1, (int) $locked->setting('seal_batch_size'));
            if ($pending->isEmpty() || (! $force && $pending->count() < $batch)) {
                return 0;
            }

            $items = $pending->all();
            // Fisher–Yates dengan random_int (CSPRNG).
            for ($i = count($items) - 1; $i > 0; $i--) {
                $j = random_int(0, $i);
                [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
            }

            $prev = $locked->ledger_head_hash ?? self::genesis($locked);
            $seq = (int) $locked->ledger_count;
            foreach ($items as $vote) {
                $seq++;
                $hash = self::link($prev, (int) $vote->candidate_id, $vote->receipt_code, $vote->nonce);
                Vote::whereKey($vote->id)->update(['seq' => $seq, 'prev_hash' => $prev, 'hash' => $hash]);
                $prev = $hash;
            }

            $locked->forceFill(['ledger_head_hash' => $prev, 'ledger_count' => $seq])->save();
            $election->setRawAttributes($locked->getAttributes(), true);

            return count($items);
        });
    }

    /**
     * @return array{ok: bool, sealed: int, pending: int, turnout: int, votes: int, head: ?string, errors: string[]}
     */
    public function verify(Election $election): array
    {
        $election->refresh();
        $errors = [];
        $prev = self::genesis($election);
        $expectedSeq = 0;

        Vote::where('election_id', $election->id)->whereNotNull('seq')->orderBy('seq')
            ->select(['id', 'candidate_id', 'receipt_code', 'nonce', 'seq', 'prev_hash', 'hash'])
            ->chunk(1000, function ($votes) use (&$prev, &$expectedSeq, &$errors) {
                foreach ($votes as $v) {
                    $expectedSeq++;
                    if ((int) $v->seq !== $expectedSeq) {
                        $errors[] = "Urutan terputus: diharapkan seq {$expectedSeq}, ditemukan {$v->seq}";
                        $expectedSeq = (int) $v->seq;
                    }
                    if ($v->prev_hash !== $prev) {
                        $errors[] = "prev_hash tidak cocok pada seq {$v->seq}";
                    }
                    $calc = self::link($prev, (int) $v->candidate_id, $v->receipt_code, $v->nonce);
                    if (! hash_equals($calc, (string) $v->hash)) {
                        $errors[] = "Hash tidak cocok pada seq {$v->seq} (data suara berubah?)";
                    }
                    $prev = (string) $v->hash;
                    if (count($errors) > 50) {
                        return false;
                    }
                }
            });

        $sealed = $expectedSeq;
        $pending = Vote::where('election_id', $election->id)->whereNull('seq')->count();
        $votes = Vote::where('election_id', $election->id)->count();
        $turnout = DB::table('voter_turnouts')->where('election_id', $election->id)->count();
        // Check-in yang belum dipakai di bilik masih tersisa sebagai hak masuk (tidak hangus oleh waktu).
        $creditsWaiting = BoothCredit::waiting($election->id)->count();

        if ($sealed > 0 && $election->ledger_head_hash !== $prev) {
            $errors[] = 'Hash terakhir di tabel pemilihan tidak sama dengan ujung rantai.';
        }
        if ((int) $election->ledger_count !== $sealed) {
            $errors[] = "ledger_count ({$election->ledger_count}) ≠ jumlah suara tersegel ({$sealed}).";
        }
        // Rekonsiliasi alur check-in → bilik, PER JABATAN: setiap check-in menjadi tepat satu suara untuk
        // setiap jabatan pada skema sesi (berpasangan: 1; terpisah: ketua & wakil) ATAU satu hak masuk tersisa.
        $byPosition = Vote::where('election_id', $election->id)
            ->select('position', DB::raw('COUNT(*) as total'))->groupBy('position')->pluck('total', 'position')
            ->map(fn ($n) => (int) $n)->all();
        foreach ($election->positions() as $position) {
            $count = $byPosition[$position] ?? 0;
            if ($count + $creditsWaiting !== $turnout) {
                $label = Election::POSITION_LABELS[$position];
                $errors[] = "Suara {$label} ({$count}) + hak masuk bilik belum terpakai ({$creditsWaiting}) ≠ jumlah check-in ({$turnout}).";
            }
        }
        foreach (array_diff(array_keys($byPosition), $election->positions()) as $stray) {
            $errors[] = "Ada {$byPosition[$stray]} suara berjabatan '{$stray}' yang tidak sesuai skema pemilihan.";
        }
        // Satu surat suara skema terpisah = satu baris per jabatan dengan resi sama: tiap resi harus lengkap.
        $ballots = Vote::where('election_id', $election->id)->distinct()->count('receipt_code');

        return [
            'ok' => $errors === [],
            'sealed' => $sealed,
            'pending' => $pending,
            'turnout' => $turnout,
            'votes' => $votes,
            'ballots' => $ballots,
            'by_position' => $byPosition,
            'credits_waiting' => $creditsWaiting,
            'head' => $sealed > 0 ? $prev : null,
            'errors' => $errors,
        ];
    }
}
