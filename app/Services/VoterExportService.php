<?php

namespace App\Services;

use App\Models\Voter;
use Illuminate\Database\Eloquent\Builder;

/**
 * Ekspor daftar pemilih ke CSV.
 *
 *  - student : nisn,nama,kelas,tanggal_lahir            ← sama persis dengan templat impor (bisa diimpor ulang)
 *  - teacher : nip,nama,tanggal_lahir,kode              ← sama persis dengan templat impor
 *  - full    : semua pemilih + jenis, status aktif, wajah terdaftar, sudah check-in (laporan; bukan format impor)
 *
 * Tidak pernah memuat data biometrik (vektor/foto wajah). UTF-8 dengan BOM agar Excel membaca huruf dengan benar;
 * pemisah koma (standar) atau titik koma (Excel versi Indonesia) — impor mengenali keduanya.
 */
class VoterExportService
{
    public const FORMATS = ['student', 'teacher', 'full'];

    /**
     * @return array{filename: string, rows: iterable<array<int, string>>, count: int}
     */
    public function build(Builder $query, string $format, string $school): array
    {
        $q = clone $query;
        if ($format === 'student') {
            $q->where('type', Voter::STUDENT);
        } elseif ($format === 'teacher') {
            $q->where('type', Voter::TEACHER);
        } else {
            $q->with('faceTemplate:id,voter_id'); // hanya untuk tahu "sudah ada wajah"; vektor tidak dimuat
        }

        $voters = $q->orderBy('type', 'desc')->orderBy('class_name')->orderBy('name')->get();

        $header = match ($format) {
            'student' => ['nisn', 'nama', 'kelas', 'tanggal_lahir'],
            'teacher' => ['nip', 'nama', 'tanggal_lahir', 'kode'],
            default => ['jenis', 'nomor_induk', 'nama', 'kelas', 'kode', 'tanggal_lahir', 'aktif', 'wajah_terdaftar', 'sudah_checkin'],
        };

        $rows = function () use ($voters, $format, $header) {
            yield $header;
            foreach ($voters as $v) {
                $dob = $v->birth_date?->format('Y-m-d') ?? '';
                yield match ($format) {
                    'student' => [(string) $v->identifier, $this->safe($v->name), $this->safe($v->class_name), $dob],
                    'teacher' => [(string) $v->identifier, $this->safe($v->name), $dob, $this->safe($v->distinguisher)],
                    default => [
                        $v->type === Voter::TEACHER ? 'guru' : 'siswa',
                        (string) $v->identifier,
                        $this->safe($v->name),
                        $this->safe($v->class_name),
                        $this->safe($v->distinguisher),
                        $dob,
                        $v->is_active ? 'ya' : 'tidak',
                        $v->faceTemplate ? 'ya' : 'belum',
                        $v->has_voted ? 'ya' : 'belum',
                    ],
                };
            }
        };

        $label = ['student' => 'siswa', 'teacher' => 'guru', 'full' => 'semua'][$format];

        return [
            'filename' => 'pemilih-'.\Illuminate\Support\Str::slug($school ?: 'sekolah').'-'.$label.'-'.now('Asia/Jakarta')->format('Ymd-Hi').'.csv',
            'rows' => $rows(),
            'count' => $voters->count(),
        ];
    }

    /**
     * Tulis ke aliran keluaran: BOM UTF-8 + baris CSV. $delimiter ',' atau ';'.
     *
     * @param  iterable<array<int, string>>  $rows
     */
    public function write($out, iterable $rows, string $delimiter): void
    {
        fwrite($out, "\xEF\xBB\xBF");
        foreach ($rows as $row) {
            fputcsv($out, $row, $delimiter, '"', '');
        }
    }

    /**
     * Cegah injeksi rumus (CSV injection): sel teks yang diawali = + - @ tab atau CR diberi apostrof di depan
     * sehingga Excel/Sheets tidak menjalankannya sebagai rumus.
     */
    private function safe(?string $value): string
    {
        $value = (string) $value;

        return $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$value : $value;
    }
}
