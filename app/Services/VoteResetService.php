<?php

namespace App\Services;

use App\Models\Election;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reset SEMUA suara satu pemilihan (untuk uji coba / gladi dengan data nyata).
 *
 * Menghapus: suara + ledger, penanda sudah check-in, tiket sesi kiosk, antrean hak masuk bilik.
 * Mengembalikan: voters.has_voted = false untuk pemilih pemilihan ini.
 * TIDAK menyentuh: pemilih, kandidat, template wajah, jadwal, status pemilihan, log aktivitas.
 * Ditolak bila hasil sudah dipublikasikan (hasil final tidak boleh diubah).
 */
class VoteResetService
{
    public function __construct(private ResultService $results, private AuditService $audit) {}

    /** @return array{votes: int, voters: int, tickets: int, attempts: int} */
    public function resetAll(Election $election, bool $clearAttempts = false): array
    {
        if ($election->status === Election::PUBLISHED) {
            throw ValidationException::withMessages(['election' => 'Hasil sudah dipublikasikan; suara tidak dapat direset.']);
        }

        $result = DB::transaction(function () use ($election, $clearAttempts) {
            // Kunci baris pemilihan agar tidak bentrok dengan penyegelan ledger yang sedang berjalan.
            $locked = Election::whereKey($election->id)->lockForUpdate()->firstOrFail();

            $voterIds = DB::table('voter_turnouts')->where('election_id', $locked->id)->pluck('voter_id');

            $tickets = DB::table('ballot_tickets')->where('election_id', $locked->id)->delete();
            DB::table('booth_credits')->where('election_id', $locked->id)->delete(); // antrean bilik ikut dikosongkan
            $votes = DB::table('votes')->where('election_id', $locked->id)->delete();
            DB::table('voter_turnouts')->where('election_id', $locked->id)->delete();
            $voters = $voterIds->chunk(500)->sum(
                fn ($ids) => DB::table('voters')->whereIn('id', $ids)->update(['has_voted' => false])
            );

            $attempts = 0;
            if ($clearAttempts) {
                $attempts = DB::table('access_attempts')->where('election_id', $locked->id)->delete();
                // Buka kunci & nolkan hitungan salah cadangan agar uji coba bisa diulang bersih.
                DB::table('voters')->where(fn ($q) => $q->whereNotNull('locked_at')->orWhere('failed_attempts', '>', 0))
                    ->where('is_simulation', $locked->is_simulation)
                    ->update(['locked_at' => null, 'failed_attempts' => 0]);
            }

            $locked->forceFill(['ledger_head_hash' => null, 'ledger_count' => 0])->save();
            $election->setRawAttributes($locked->getAttributes(), true);

            return compact('votes', 'voters', 'tickets', 'attempts');
        });

        $this->results->forget($election);
        $this->audit->log('votes.reset_all', $election, $result + ['status' => $election->status, 'clear_attempts' => $clearAttempts]);

        return $result;
    }
}
