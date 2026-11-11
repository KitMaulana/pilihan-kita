<?php

namespace App\Services;

use App\Exceptions\KioskException;
use App\Models\BoothCredit;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\KioskDevice;
use App\Models\Vote;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Pemungutan suara di BILIK (§6.5, alur check-in → bilik).
 *
 * Bilik tidak pernah tahu siapa pemilihnya. Satu transaksi: ambil & kunci satu hak masuk
 * bilik anonim yang masih berlaku (booth_credits, antrean FIFO) → sisipkan votes (tanpa
 * identitas, UUIDv4, tanpa waktu) → hapus hak masuk tersebut. Jumlah suara tidak pernah bisa
 * melebihi jumlah check-in. Idempotency key membuat pengiriman ulang mengembalikan resi yang sama.
 */
class VoteService
{
    private const RECEIPT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    public function __construct(private LedgerService $ledger) {}

    /** @return array{receipt_code: string, replayed: bool} */
    public function cast(Election $election, KioskDevice $device, int $candidateId, string $idempotencyKey): array
    {
        $idemKey = 'vote-idem:'.hash('sha256', $device->id.'|'.$idempotencyKey);

        if ($cached = Cache::get($idemKey)) {
            return ['receipt_code' => $cached, 'replayed' => true];
        }

        $candidate = Candidate::where('election_id', $election->id)->where('is_active', true)->find($candidateId);
        if (! $candidate) {
            throw new KioskException('invalid_candidate', 'Kandidat tidak valid. Silakan pilih ulang.');
        }

        // Kunci idempotensi singkat: dua kiriman paralel dengan key sama tidak memakai dua hak masuk.
        $lock = Cache::lock($idemKey.':lock', 10);
        if (! $lock->block(5)) {
            throw new KioskException('busy', 'Sedang memproses. Silakan tunggu sebentar.', 429);
        }

        try {
            if ($cached = Cache::get($idemKey)) {
                return ['receipt_code' => $cached, 'replayed' => true];
            }

            $receipt = null;
            // Ulangi bila hak masuk yang dikunci sudah dipakai bilik lain di transaksi paralel.
            for ($try = 0; $try < 3 && ! $receipt; $try++) {
                $receipt = DB::transaction(function () use ($election, $candidate) {
                    $credit = BoothCredit::waiting($election->id)->orderBy('expires_at')->lockForUpdate()->first();
                    if (! $credit) {
                        return null;
                    }
                    if (BoothCredit::whereKey($credit->id)->delete() !== 1) {
                        return null; // sudah dipakai bilik lain
                    }

                    return $this->insertVote($election, $candidate)->receipt_code;
                }, 3);
            }

            if (! $receipt) {
                throw new KioskException('no_checkin', 'Belum ada pemilih yang check-in untuk bilik ini. Silakan check-in dulu di meja check-in, atau hubungi panitia.', 409);
            }

            Cache::put($idemKey, $receipt, now()->addMinutes(30));
        } finally {
            $lock->release();
        }

        // Penyegelan batch ledger (urutan diacak) tidak boleh menggagalkan suara yang sudah tercatat.
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
}
