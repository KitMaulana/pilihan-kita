<?php

namespace App\Services;

use App\Models\BallotTicket;
use App\Models\Election;
use Illuminate\Validation\ValidationException;

/** Transisi status pemilihan: draft → open → closed → published. */
class ElectionService
{
    public const TRANSITIONS = [
        Election::DRAFT => [Election::OPEN, Election::CLOSED], // draf boleh langsung ditutup (dibatalkan)
        Election::OPEN => [Election::CLOSED],
        Election::CLOSED => [Election::PUBLISHED, Election::OPEN],
        Election::PUBLISHED => [],
    ];

    public function __construct(
        private LedgerService $ledger,
        private ResultService $results,
        private AuditService $audit,
    ) {}

    public function transition(Election $election, string $to): array
    {
        $from = $election->status;
        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw ValidationException::withMessages(['status' => "Tidak bisa mengubah status dari '{$from}' ke '{$to}'."]);
        }

        $info = [];

        if ($to === Election::OPEN) {
            if ($election->candidates()->where('is_active', true)->count() < 1) {
                throw ValidationException::withMessages(['status' => 'Tambahkan minimal satu kandidat aktif sebelum membuka pemilihan.']);
            }
            if ($election->closes_at && $election->closes_at->isPast()) {
                throw ValidationException::withMessages(['status' => 'Jam tutup sudah lewat. Perbarui jadwal terlebih dahulu.']);
            }
            $election->closed_at = null;
        }

        if ($to === Election::CLOSED) {
            $election->status = Election::CLOSED; // set dulu agar seal() membaca status baru bila perlu
            $election->closed_at = now();
            $election->save();
            BallotTicket::where('election_id', $election->id)->delete();
            $info['sealed'] = $this->ledger->seal($election, force: true);
            $info['verification'] = $this->ledger->verify($election);
        }

        if ($to === Election::PUBLISHED) {
            $this->ledger->seal($election, force: true);
            $verification = $this->ledger->verify($election);
            if (! $verification['ok']) {
                throw ValidationException::withMessages(['status' => 'Verifikasi ledger gagal: '.implode('; ', array_slice($verification['errors'], 0, 3))]);
            }
            $election->published_at = now();
            $info['verification'] = $verification;
        }

        $election->status = $to;
        $election->save();
        $this->results->forget($election);

        $this->audit->log('election.status', $election, ['from' => $from, 'to' => $to] + array_intersect_key($info, ['sealed' => 1]));

        return $info;
    }

    /** Pengaman otomatis: bila jam tutup lewat, tutup pemilihan (dipanggil scheduler tiap menit). */
    public function autoClose(): ?Election
    {
        $election = Election::current();
        if ($election && $election->status === Election::OPEN && $election->closes_at && $election->closes_at->isPast()) {
            $this->transition($election, Election::CLOSED);

            return $election;
        }

        return null;
    }
}
