<?php

namespace App\Services;

use App\Exceptions\KioskException;
use App\Models\AccessAttempt;
use App\Models\BallotTicket;
use App\Models\BoothCredit;
use App\Models\Election;
use App\Models\KioskDevice;
use App\Models\Voter;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Identifikasi pemilih di kiosk (wajah / cadangan) dan konfirmasi nama.
 * Server adalah sumber kebenaran: tablet hanya menerima nama + kelas + tiket sesi.
 */
class KioskAccessService
{
    public function __construct(private FaceMatchService $matcher) {}

    /**
     * @param  float[]  $embedding
     * @param  array{passed?: bool, challenges?: array}  $liveness
     */
    public function identifyByFace(Election $election, KioskDevice $device, array $embedding, array $liveness): array
    {
        if ($election->setting('require_liveness') && empty($liveness['passed'])) {
            $this->attempt($election, $device, null, 'face', 'liveness_failed', 'Liveness gagal di perangkat', true);
            throw new KioskException('liveness_failed', 'Verifikasi gerakan tidak berhasil. Silakan coba lagi atau gunakan jalur cadangan.');
        }

        // 1:N hanya terhadap pemilih sesi (sekolah) tablet ini.
        $result = $this->matcher->match($embedding, null, $election->id);
        $decision = $this->matcher->decide(
            $result,
            (float) $election->setting('match_threshold'),
            (float) $election->setting('match_margin'),
        );
        $scores = ['score_top' => round($result['s1'], 4), 'score_margin' => round($result['s1'] - $result['s2'], 4)];

        if ($decision !== 'matched') {
            $this->attempt($election, $device, null, 'face', $decision, $decision === 'ambiguous'
                ? 'Selisih skor dengan peringkat 2 terlalu kecil' : 'Skor di bawah ambang', false, $scores);
            throw new KioskException('not_recognized', 'Wajah belum dikenali. Coba lagi dengan wajah menghadap kamera, atau gunakan jalur cadangan.');
        }

        $voter = Voter::find($result['voter_id']);

        return $this->admit($election, $device, $voter, 'face', $scores);
    }

    /**
     * Cadangan: siswa = NISN + tgl lahir; guru = NIP + tgl lahir; guru tanpa NIP = nama + tgl lahir (+ kode).
     */
    public function identifyByFallback(Election $election, KioskDevice $device, array $input): array
    {
        $type = $input['type'];
        $birthDate = $input['birth_date'];
        $identifier = isset($input['identifier']) ? preg_replace('/[\s.\-]/', '', (string) $input['identifier']) : null;
        $generic = 'Data tidak cocok. Periksa kembali isian Anda.';

        $base = Voter::where('type', $type)->where('election_id', $election->id);

        if ($identifier) {
            $voter = (clone $base)->where('identifier', $identifier)->first();
            if (! $voter) {
                $this->attempt($election, $device, null, 'fallback', 'wrong_data', 'Nomor induk tidak ditemukan');
                throw new KioskException('wrong_data', $generic);
            }

            // Pemilih sudah dikenal → cek kunci SEBELUM membandingkan tanggal lahir.
            $this->ensureNotLocked($election, $device, $voter);

            if ($voter->birth_date->format('Y-m-d') !== $birthDate) {
                $this->registerFailure($election, $device, $voter);
            }
        } else {
            if ($type !== Voter::TEACHER || empty($input['name'])) {
                throw new KioskException('wrong_data', $generic);
            }
            $name = trim(preg_replace('/\s+/', ' ', $input['name']));
            $candidates = (clone $base)->whereNull('identifier')
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->whereDate('birth_date', $birthDate)
                ->get();

            if (! empty($input['distinguisher'])) {
                $candidates = $candidates->filter(fn ($v) => mb_strtolower((string) $v->distinguisher) === mb_strtolower(trim($input['distinguisher'])));
            }

            if ($candidates->isEmpty()) {
                $this->attempt($election, $device, null, 'fallback', 'wrong_data', 'Nama + tanggal lahir tidak ditemukan');
                throw new KioskException('wrong_data', $generic);
            }
            if ($candidates->count() > 1) {
                $this->attempt($election, $device, null, 'fallback', 'rejected', 'Nama + tanggal lahir ganda');
                throw new KioskException('ambiguous_identity', 'Data Anda sama dengan pemilih lain. Isi kode guru atau hubungi panitia.', 422, ['need_distinguisher' => true]);
            }
            $voter = $candidates->first();
            $this->ensureNotLocked($election, $device, $voter);
        }

        if ($voter->failed_attempts > 0) {
            DB::table('voters')->where('id', $voter->id)->update(['failed_attempts' => 0]);
        }

        return $this->admit($election, $device, $voter, 'fallback');
    }

    /**
     * Pemilih menekan Ya/Tidak di layar konfirmasi nama (meja CHECK-IN).
     *
     * "Ya" = CHECK-IN dalam satu transaksi:
     *   voter_turnouts (PK = sekali seumur pemilihan) + voters.has_voted
     *   + satu hak masuk bilik ANONIM (booth_credits, tanpa voter_id).
     * Bilik suara kemudian memakai hak masuk mana pun yang tersedia, sehingga suara
     * tidak pernah bisa dikaitkan ke pemilih yang check-in.
     *
     * @return array{confirmed: bool, checked_in?: bool, message?: string}
     */
    public function confirm(Election $election, KioskDevice $device, string $ticketToken, bool $accepted): array
    {
        if (! $accepted) {
            $ticket = $this->findTicket($election, $device, $ticketToken, BallotTicket::IDENTIFIED);
            $ticket->delete();
            // Wajah cocok tapi pemilih bilang "bukan saya" = kemungkinan salah-kenal → tandai.
            $this->attempt($election, $device, $ticket->voter_id, $ticket->method, 'rejected',
                'Pemilih menolak konfirmasi nama', $ticket->method === 'face');

            return ['confirmed' => false];
        }

        try {
            [$voterId, $method] = DB::transaction(function () use ($election, $device, $ticketToken) {
                $ticket = $this->findTicket($election, $device, $ticketToken, BallotTicket::IDENTIFIED, lock: true);
                // Kunci baris pemilih supaya check-in paralel (dua meja) antre.
                $voter = DB::table('voters')->where('id', $ticket->voter_id)->lockForUpdate()->first();

                if (DB::table('voter_turnouts')->where('election_id', $election->id)->where('voter_id', $voter->id)->exists()) {
                    $ticket->delete();
                    throw new KioskException('already_voted', 'Anda sudah check-in / menggunakan hak pilih sebelumnya.', 409);
                }

                // PK komposit = pengaman terakhir satu orang satu hak pilih.
                DB::table('voter_turnouts')->insert(['election_id' => $election->id, 'voter_id' => $voter->id]);
                DB::table('voters')->where('id', $voter->id)->update(['has_voted' => true]);
                BoothCredit::create(['election_id' => $election->id, 'queued_at' => now()]);

                $method = $ticket->method;
                $ticket->delete();

                return [$voter->id, $method];
            }, 3);
        } catch (QueryException $e) {
            // Hanya pelanggaran PK voter_turnouts (check-in paralel) yang berarti "sudah check-in".
            if ((string) ($e->errorInfo[0] ?? $e->getCode()) !== '23000' && ! str_contains(strtolower($e->getMessage()), 'unique')) {
                throw $e;
            }
            throw new KioskException('already_voted', 'Anda sudah check-in / menggunakan hak pilih sebelumnya.', 409);
        }

        $this->attempt($election, $device, $voterId, $method, 'checked_in');

        return [
            'confirmed' => true,
            'checked_in' => true,
            'message' => 'Check-in berhasil. Silakan menuju bilik suara yang kosong.',
        ];
    }

    public function findTicket(Election $election, KioskDevice $device, string $plain, string $stage, bool $lock = false): BallotTicket
    {
        $query = BallotTicket::where('token_hash', hash('sha256', $plain))->where('election_id', $election->id);
        if ($lock) {
            $query->lockForUpdate();
        }
        $ticket = $query->first();

        if (! $ticket || $ticket->stage !== $stage || $ticket->device_id !== $device->id) {
            throw new KioskException('session_invalid', 'Sesi tidak valid. Silakan ulangi dari awal.', 410);
        }
        if ($ticket->expires_at->isPast()) {
            $ticket->delete();
            throw new KioskException('session_expired', 'Waktu sesi habis. Silakan ulangi dari awal.', 410);
        }

        return $ticket;
    }

    private function admit(Election $election, KioskDevice $device, ?Voter $voter, string $method, array $scores = []): array
    {
        if (! $voter || ! $voter->is_active || $voter->election_id !== $election->id) {
            $this->attempt($election, $device, $voter?->id, $method, 'rejected', 'Pemilih tidak aktif / bukan peserta pemilihan ini', false, $scores);
            throw new KioskException('not_eligible', 'Anda tidak terdaftar sebagai pemilih aktif. Hubungi panitia.', 403);
        }

        $alreadyVoted = DB::table('voter_turnouts')
            ->where('election_id', $election->id)->where('voter_id', $voter->id)->exists();
        if ($alreadyVoted) {
            $this->attempt($election, $device, $voter->id, $method, 'already_voted', null, false, $scores);
            throw new KioskException('already_voted', 'Anda sudah menggunakan hak pilih. Terima kasih.', 409);
        }

        // Satu tiket aktif per pemilih: tiket lama (mis. di tablet lain) dibatalkan.
        BallotTicket::where('voter_id', $voter->id)->delete();

        $plain = Str::random(48);
        $ttl = (int) $election->setting('ticket_identified_ttl');
        BallotTicket::create([
            'token_hash' => hash('sha256', $plain),
            'election_id' => $election->id,
            'voter_id' => $voter->id,
            'device_id' => $device->id,
            'method' => $method,
            'stage' => BallotTicket::IDENTIFIED,
            'expires_at' => now()->addSeconds($ttl),
        ]);

        $this->attempt($election, $device, $voter->id, $method, 'matched', null, false, $scores);

        return [
            'ticket' => $plain,
            'name' => $voter->name,
            'class_name' => $voter->displayClass(),
            'type' => $voter->type,
            'expires_in' => $ttl,
        ];
    }

    private function ensureNotLocked(Election $election, KioskDevice $device, Voter $voter): void
    {
        if ($voter->isLocked()) {
            $this->attempt($election, $device, $voter->id, 'fallback', 'locked', 'Percobaan pada pemilih terkunci', true);
            throw new KioskException('locked', 'Akses cadangan untuk data ini terkunci karena terlalu banyak percobaan salah. Hubungi panitia.', 423);
        }
    }

    /** Tanggal lahir salah: tambah hitungan, kunci bila mencapai batas. Selalu melempar exception. */
    private function registerFailure(Election $election, KioskDevice $device, Voter $voter): never
    {
        $max = (int) $election->setting('max_fallback_attempts');
        $failed = $voter->failed_attempts + 1;
        $locked = $failed >= $max;

        DB::table('voters')->where('id', $voter->id)->update([
            'failed_attempts' => $failed,
            'locked_at' => $locked ? now() : null,
        ]);

        $this->attempt($election, $device, $voter->id, 'fallback', $locked ? 'locked' : 'wrong_data',
            "Tanggal lahir salah ({$failed}/{$max})", $failed >= 2);

        if ($locked) {
            throw new KioskException('locked', 'Terlalu banyak percobaan salah. Akses cadangan untuk data ini dikunci. Hubungi panitia.', 423);
        }

        $left = $max - $failed;
        throw new KioskException('wrong_data', "Data tidak cocok. Sisa percobaan: {$left}.", 422, ['attempts_left' => $left]);
    }

    public function attempt(Election $election, ?KioskDevice $device, ?int $voterId, string $method, string $result,
        ?string $reason = null, bool $suspicious = false, array $scores = []): void
    {
        AccessAttempt::create([
            'election_id' => $election->id,
            'voter_id' => $voterId,
            'device_id' => $device?->id,
            'method' => $method,
            'result' => $result,
            'reason' => $reason,
            'is_suspicious' => $suspicious,
            'score_top' => $scores['score_top'] ?? null,
            'score_margin' => $scores['score_margin'] ?? null,
        ]);
    }
}
