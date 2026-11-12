<?php

namespace App\Services;

use App\Models\Election;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Menghapus SATU sesi (sekolah) beserta SELURUH datanya, permanen:
 * suara, ledger, penanda check-in, antrean bilik, tiket, daftar pemilih (+ template wajah),
 * kandidat (+ foto), perangkat (token langsung tidak berlaku), log percobaan akses & log aktivitas sesi.
 *
 * Tidak menyentuh sekolah lain. Akun panitia sekolah ini tidak dihapus, tetapi dilepas dari sekolah
 * (menjadi "belum ditugaskan" dan terkunci sampai admin menugaskan ulang).
 * Catatan penghapusan sendiri tetap disimpan di log aktivitas (tanpa data pemilih).
 */
class SessionDeletionService
{
    public function __construct(private FaceMatchService $matcher, private ResultService $results, private AuditService $audit) {}

    /** Kalimat yang harus diketik admin: memuat nama sekolah agar sekolah yang salah tidak terhapus. */
    public static function confirmPhrase(Election $election): string
    {
        return 'HAPUS '.mb_strtoupper(trim((string) $election->school_name));
    }

    /** Sesi yang masih dibuka tidak boleh dihapus (tutup dulu). */
    public static function canDelete(Election $election): bool
    {
        return $election->status !== Election::OPEN;
    }

    /**
     * @return array{voters: int, votes: int, candidates: int, devices: int, panitia: int, logs: int}
     */
    public function delete(Election $election, string $confirm): array
    {
        if (! self::canDelete($election)) {
            throw ValidationException::withMessages(['confirm' => 'Pemilihan masih dibuka. Tutup pemilihan terlebih dahulu sebelum menghapus sesi.']);
        }
        $expected = self::confirmPhrase($election);
        if (mb_strtoupper(trim(preg_replace('/\s+/', ' ', $confirm))) !== $expected) {
            throw ValidationException::withMessages(['confirm' => "Ketik \"{$expected}\" untuk mengonfirmasi."]);
        }

        $id = $election->id;
        $label = $election->label();
        $school = $election->school_name;
        $photos = $election->candidates()->whereNotNull('photo_path')->pluck('photo_path')->all();

        $counts = DB::transaction(function () use ($id) {
            $voterIds = DB::table('voters')->where('election_id', $id)->select('id');

            // Urutan penting: suara menunjuk kandidat (RESTRICT), pesanan bilik menunjuk perangkat.
            DB::table('booth_credits')->where('election_id', $id)->delete();
            DB::table('ballot_tickets')->where('election_id', $id)->delete();
            $votes = DB::table('votes')->where('election_id', $id)->delete();
            DB::table('voter_turnouts')->where('election_id', $id)->delete();
            DB::table('access_attempts')->where('election_id', $id)->delete();
            $logs = DB::table('activity_logs')->where('election_id', $id)->delete(); // memuat nama/NISN pemilih pada detailnya
            DB::table('face_templates')->whereIn('voter_id', $voterIds)->delete();
            $voters = DB::table('voters')->where('election_id', $id)->delete();
            $candidates = DB::table('candidates')->where('election_id', $id)->delete();
            $devices = DB::table('kiosk_devices')->where('election_id', $id)->delete();
            $panitia = DB::table('users')->where('election_id', $id)->update(['election_id' => null]);
            DB::table('elections')->where('id', $id)->delete();

            return compact('voters', 'votes', 'candidates', 'devices', 'panitia', 'logs');
        });

        foreach ($photos as $path) {
            Storage::disk('public')->delete($path);
        }
        $this->results->forget($election);
        $this->matcher->flush();

        // Catat penghapusan TANPA terikat sesi (sesinya sudah tidak ada) dan tanpa data pemilih.
        Election::useCurrent(null);
        $this->audit->log('election.deleted', null, ['election_id' => $id, 'school' => $school, 'name' => $election->name, 'status' => $election->status] + $counts);

        return $counts + ['label' => $label];
    }
}
