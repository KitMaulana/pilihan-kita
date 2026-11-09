<?php

namespace App\Services;

use App\Exceptions\KioskException;
use App\Models\BallotTicket;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\KioskDevice;
use App\Models\Vote;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Pemungutan suara atomik (§6.5).
 *
 * Satu transaksi: kunci tiket + baris pemilih → sisipkan voter_turnouts (PK komposit = jaminan
 * satu orang satu suara di level DB) → set voters.has_voted → sisipkan votes (tanpa identitas)
 * → hapus tiket. Idempotency key membuat pengiriman ulang mengembalikan resi yang sama.
 */
class VoteService
{
    private const RECEIPT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    public function __construct(private KioskAccessService $access, private LedgerService $ledger) {}

    /** @return array{receipt_code: string, replayed: bool} */
    public function cast(Election $election, KioskDevice $device, string $voteToken, int $candidateId, string $idempotencyKey): array
    {
        $idemKey = 'vote-idem:'.hash('sha256', $device->id.'|'.$idempotencyKey);

        if ($cached = Cache::get($idemKey)) {
            return ['receipt_code' => $cached, 'replayed' => true];
        }

        $candidate = Candidate::where('election_id', $election->id)->where('is_active', true)->find($candidateId);
        if (! $candidate) {
            throw new KioskException('invalid_candidate', 'Kandidat tidak valid. Silakan pilih ulang.');
        }

        try {
            $receipt = DB::transaction(function () use ($election, $device, $voteToken, $candidate) {
                $ticket = $this->access->findTicket($election, $device, $voteToken, BallotTicket::CONFIRMED, lock: true);

                // Kunci baris pemilih (FOR UPDATE) supaya permintaan paralel antre.
                $voter = DB::table('voters')->where('id', $ticket->voter_id)->lockForUpdate()->first();

                $already = DB::table('voter_turnouts')
                    ->where('election_id', $election->id)->where('voter_id', $voter->id)->exists();
                if ($already) {
                    $ticket->delete();
                    throw new KioskException('already_voted', 'Suara Anda sudah tercatat sebelumnya.', 409);
                }

                // Unique/PK constraint = pengaman terakhir bila dua transaksi lolos bersamaan.
                DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);
                // Query builder (bukan Eloquent) → tidak menyentuh kolom waktu apa pun.
                DB::table('voters')->where('id', $voter->id)->update(['has_voted' => true]);

                $vote = $this->insertVote($election, $candidate);
                $ticket->delete();

                return $vote->receipt_code;
            }, 3);
        } catch (QueryException $e) {
            // Pelanggaran PK voter_turnouts → pemilih sudah memilih di transaksi lain.
            if ($this->isUniqueViolation($e)) {
                if ($cached = Cache::get($idemKey)) {
                    return ['receipt_code' => $cached, 'replayed' => true];
                }
                throw new KioskException('already_voted', 'Suara Anda sudah tercatat sebelumnya.', 409);
            }
            throw $e;
        } catch (KioskException $e) {
            // Permintaan ulang paralel yang kalah balapan: tiket sudah terpakai oleh permintaan pertama.
            if ($e->status === 410 && ($cached = Cache::get($idemKey))) {
                return ['receipt_code' => $cached, 'replayed' => true];
            }
            throw $e;
        }

        Cache::put($idemKey, $receipt, now()->addMinutes(30));

        // Penyegelan batch ledger tidak boleh menggagalkan suara yang sudah tercatat.
        try {
            $this->ledger->seal($election);
        } catch (Throwable $e) {
            report($e);
        }

        return ['receipt_code' => $receipt, 'replayed' => false];
    }

    private function insertVote(Election $election, Candidate $candidate): Vote
    {
        for ($i = 0; $i < 5; $i++) {
            $code = $this->receiptCode();
            if (! Vote::where('receipt_code', $code)->exists()) {
                return Vote::create([
                    'election_id' => $election->id,
                    'candidate_id' => $candidate->id,
                    'receipt_code' => $code,
                    'nonce' => bin2hex(random_bytes(16)),
                ]);
            }
        }
        throw new \RuntimeException('Gagal membuat kode resi unik.');
    }

    /** Format XXXX-XXXX-XX dari alfabet tanpa karakter ambigu (0/O, 1/I). ≈50 bit acak. */
    public function receiptCode(): string
    {
        $chars = '';
        for ($i = 0; $i < 10; $i++) {
            $chars .= self::RECEIPT_ALPHABET[random_int(0, strlen(self::RECEIPT_ALPHABET) - 1)];
        }

        return substr($chars, 0, 4).'-'.substr($chars, 4, 4).'-'.substr($chars, 8, 2);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) ($e->errorInfo[0] ?? $e->getCode());

        return $code === '23000' || str_contains(strtolower($e->getMessage()), 'unique');
    }
}
