<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use App\Services\CandidatePhotoService;
use Illuminate\Console\Command;

/**
 * Diagnosis foto kandidat: apakah berkas foto benar-benar ada di server dan berapa ukurannya.
 *   php artisan candidates:photos              → daftar & status
 *   php artisan candidates:photos --optimize   → perkecil foto besar (≤ 1000 px) sekalian
 */
class CandidatePhotosCommand extends Command
{
    protected $signature = 'candidates:photos {--optimize : Perkecil foto yang terlalu besar}';

    protected $description = 'Periksa berkas foto kandidat (ada/hilang, ukuran) dan opsional perkecil foto besar';

    public function handle(CandidatePhotoService $photos): int
    {
        $rows = [];
        $missing = 0;
        foreach (Candidate::with('election:id,school_name')->orderBy('election_id')->orderBy('position')->orderBy('number')->get() as $c) {
            $status = '—';
            $size = '';
            if ($c->photo_path) {
                $disk = \Illuminate\Support\Facades\Storage::disk('public');
                if (! $photos->exists($c->photo_path)) {
                    $status = 'HILANG';
                    $missing++;
                } else {
                    $bytes = $disk->size($c->photo_path);
                    $size = number_format($bytes / 1024, 0).' KB';
                    $status = 'ada';
                    if ($this->option('optimize') && ($r = $photos->optimizeExisting($c->photo_path))) {
                        $c->forceFill(['photo_path' => $r['path']])->save();
                        $status = 'diperkecil';
                        $size = number_format($r['before'] / 1024, 0).' → '.number_format($r['after'] / 1024, 0).' KB';
                    }
                }
            }
            $rows[] = [$c->election?->school_name ?? '—', $c->position ?? 'pair', $c->number, $c->name, $c->photo_path ?: '(belum ada foto)', $status, $size];
        }

        $this->table(['Sekolah', 'Jabatan', 'No', 'Nama', 'Berkas', 'Status', 'Ukuran'], $rows);
        if ($missing > 0) {
            $this->warn("$missing foto tercatat di database tetapi berkasnya TIDAK ada di server. Unggah ulang lewat menu Kandidat.");
        }

        return self::SUCCESS;
    }
}
