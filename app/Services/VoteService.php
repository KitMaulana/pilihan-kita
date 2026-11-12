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

    /**
     * Satu SURAT SUARA = satu hak masuk bilik = satu kode resi.
     * Skema berpasangan: $choices = ['pair' => candidateId].
     * Skema terpisah  : $choices = ['ketua' => candidateId, 'wakil' => candidateId] — keduanya wajib.
     * Semua pilihan disimpan dalam satu transaksi (tidak mungkin tercatat sebagian).
     *
     * @param  array<string, int|string>  $choices
     * @return array{receipt_code: string, replayed: bool}
     */
    public function cast(Election $election, KioskDevice $device, array $choices, string $idempotencyKey): array
    {
        $idemKey = 'vote-idem:'.hash('sha256', $device->id.'|'.$idempotencyKey);

        if ($cached = Cache::get($idemKey)) {
            return ['receipt_code' => $cached, 'replayed' => true];
        }

        $candidates = $this->resolveChoices($election, $choices);

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
                $receipt = DB::transaction(function () use ($election, $candidates, $device) {
                    // Utamakan hak masuk yang DIPESAN bilik ini; bila pesanannya sudah dilepas (bilik sempat
                    // tidak terlihat), ambil yang masih antre. Hak masuk yang dipesan bilik lain tidak disentuh.
                    $credit = BoothCredit::heldBy($election->id, $device->id)->lockForUpdate()->first()
                        ?? BoothCredit::unclaimed($election->id)->orderBy('queued_at')->lockForUpdate()->first();
                    if (! $credit) {
                        return null;
                    }
                    if (BoothCredit::whereKey($credit->id)->delete() !== 1) {
                        return null; // sudah dipakai bilik lain
                    }

                    return $this->insertBallot($election, $candidates);
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

    /**
     * Pilihan harus lengkap untuk SETIAP jabatan pada skema sesi, dan tiap kandidat harus aktif,
     * milik sesi ini, dan berjabatan sesuai (calon wakil tidak bisa dipilih sebagai ketua).
     *
     * @return array<string, Candidate> jabatan => kandidat, sesuai urutan jabatan sesi
     */
    private function resolveChoices(Election $election, array $choices): array
    {
        $resolved = [];
        foreach ($election->positions() as $position) {
            $id = $choices[$position] ?? null;
            $label = Election::POSITION_LABELS[$position];
            if (! is_numeric($id)) {
                throw new KioskException('incomplete_ballot', $position === 'pair'
                    ? 'Pilih salah satu kandidat terlebih dahulu.'
                    : "Pilihan {$label} belum diisi. Silakan pilih ulang.");
            }
            $candidate = Candidate::where('election_id', $election->id)->where('is_active', true)
                ->where('position', $position)->find((int) $id);
            if (! $candidate) {
                throw new KioskException('invalid_candidate', $position === 'pair'
                    ? 'Kandidat tidak valid. Silakan pilih ulang.'
                    : "Calon {$label} tidak valid. Silakan pilih ulang.");
            }
            $resolved[$position] = $candidate;
        }
        $extra = array_diff(array_keys($choices), $election->positions());
        if ($extra !== []) {
            throw new KioskException('invalid_candidate', 'Surat suara tidak sesuai skema pemilihan. Muat ulang halaman bilik.');
        }

        return $resolved;
    }

    /**
     * Simpan satu surat suara: satu baris per jabatan, KODE RESI SAMA, tanpa identitas & tanpa waktu.
     *
     * @param  array<string, Candidate>  $candidates
     */
    private function insertBallot(Election $election, array $candidates): string
    {
        for ($i = 0; $i < 5; $i++) {
            $code = $this->receiptCode();
            if (Vote::where('receipt_code', $code)->exists()) {
                continue;
            }
            foreach ($candidates as $position => $candidate) {
                Vote::create([
                    'election_id' => $election->id,
                    'candidate_id' => $candidate->id,
                    'position' => $position,
                    'receipt_code' => $code,
                    'nonce' => bin2hex(random_bytes(16)),
                ]);
            }

            return $code;
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
