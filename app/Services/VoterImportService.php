<?php

namespace App\Services;

use App\Models\Voter;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Impor CSV pemilih dengan pola pratinjau → konfirmasi.
 *  - siswa: nisn,nama,kelas,tanggal_lahir
 *  - guru : nip,nama,tanggal_lahir[,kode]   (nip boleh kosong; kode = pembeda opsional)
 */
class VoterImportService
{
    public const MAX_ROWS = 2000;

    public const HEADERS = [
        Voter::STUDENT => ['nisn', 'nama', 'kelas', 'tanggal_lahir'],
        Voter::TEACHER => ['nip', 'nama', 'tanggal_lahir', 'kode'],
    ];

    public function template(string $type): string
    {
        return match ($type) {
            Voter::STUDENT => "nisn,nama,kelas,tanggal_lahir\n0071234567,Ahmad Fauzi,XI IPA 1,2008-03-14\n0079876543,Siti Aminah,X-3,21/07/2009\n",
            Voter::TEACHER => "nip,nama,tanggal_lahir,kode\n198001012005011001,Drs. Budi Santoso,1980-01-01,\n,Rina Marlina S.Pd.,1990-05-12,G-21\n",
            default => throw new InvalidArgumentException('Jenis pemilih tidak dikenal.'),
        };
    }

    /**
     * Membaca CSV dan menghasilkan pratinjau baris siap/bermasalah.
     *
     * @return array{token: string, type: string, ready: array, problems: array, summary: array}
     */
    public function preview(string $csv, string $type): array
    {
        $rows = $this->parseCsv($csv, $type);

        if (count($rows) > self::MAX_ROWS) {
            throw new InvalidArgumentException('Maksimal '.self::MAX_ROWS.' baris per impor (ditemukan '.count($rows).').');
        }

        $ready = [];
        $problems = [];
        $seenIds = [];
        $seenNameDob = [];

        // Data yang sudah ada di DB, untuk menandai "perbarui" vs "baru".
        $existingIds = Voter::where('type', $type)->whereNotNull('identifier')
            ->pluck('id', 'identifier')->all();
        $existingNoId = $type === Voter::TEACHER
            ? Voter::where('type', $type)->whereNull('identifier')->get(['id', 'name', 'birth_date', 'distinguisher'])
                ->groupBy(fn ($v) => $this->nameKey($v->name, $v->birth_date->format('Y-m-d')))
            : collect();

        foreach ($rows as $row) {
            $line = $row['_line'];
            $errors = [];

            $identifier = preg_replace('/[\s.\-]/', '', (string) ($row[$type === Voter::STUDENT ? 'nisn' : 'nip'] ?? ''));
            $name = trim(preg_replace('/\s+/', ' ', (string) ($row['nama'] ?? '')));
            $class = trim((string) ($row['kelas'] ?? '')) ?: null;
            $distinguisher = trim((string) ($row['kode'] ?? '')) ?: null;
            $dobRaw = trim((string) ($row['tanggal_lahir'] ?? ''));
            $dob = $this->normalizeDate($dobRaw);

            if ($name === '') {
                $errors[] = 'Nama kosong';
            } elseif (mb_strlen($name) > 120) {
                $errors[] = 'Nama terlalu panjang';
            }

            if ($type === Voter::STUDENT) {
                if ($identifier === '') {
                    $errors[] = 'NISN kosong';
                } elseif (! preg_match('/^\d{10}$/', $identifier)) {
                    $errors[] = 'NISN harus 10 digit angka'.(preg_match('/^\d{6,9}$/', $identifier)
                        ? ' (nol di depan kemungkinan terhapus Excel — format kolom sebagai Teks)' : '');
                }
                if (! $class) {
                    $errors[] = 'Kelas kosong';
                }
            } elseif ($identifier !== '' && ! preg_match('/^\d{18}$/', $identifier)) {
                $errors[] = 'NIP harus 18 digit angka (atau dikosongkan)';
            }

            if ($dobRaw === '') {
                $errors[] = 'Tanggal lahir kosong';
            } elseif (! $dob) {
                $errors[] = "Tanggal lahir tidak valid ({$dobRaw}); gunakan YYYY-MM-DD atau DD/MM/YYYY";
            }

            $action = 'baru';
            if (! $errors) {
                if ($identifier !== '') {
                    if (isset($seenIds[$identifier])) {
                        $errors[] = 'Duplikat '.($type === Voter::STUDENT ? 'NISN' : 'NIP')." dengan baris {$seenIds[$identifier]}";
                    } else {
                        $seenIds[$identifier] = $line;
                        if (isset($existingIds[$identifier])) {
                            $action = 'perbarui';
                        }
                    }
                } else {
                    // Guru tanpa NIP: nama + tanggal lahir (+ kode) harus unik.
                    // (Ganda TANPA kode ditangani setelah loop: semua baris di grup itu ditandai.)
                    $key = $this->nameKey($name, $dob).'|'.mb_strtolower((string) $distinguisher);
                    $baseKey = $this->nameKey($name, $dob);
                    if ($distinguisher && isset($seenNameDob[$key])) {
                        $errors[] = "Nama + tanggal lahir sama dengan baris {$seenNameDob[$key]}; isi kolom 'kode' sebagai pembeda";
                    } else {
                        $seenNameDob[$key] = $line;
                        $existing = $existingNoId->get($baseKey);
                        if ($existing) {
                            $match = $existing->first(fn ($v) => mb_strtolower((string) $v->distinguisher) === mb_strtolower((string) $distinguisher));
                            if ($match) {
                                $action = 'perbarui';
                            }
                        }
                    }
                }
            }

            $clean = [
                'line' => $line,
                'identifier' => $identifier !== '' ? $identifier : null,
                'name' => $name,
                'class_name' => $type === Voter::STUDENT ? $class : ($class ?: null),
                'birth_date' => $dob,
                'distinguisher' => $distinguisher,
                'action' => $action,
            ];

            if ($errors) {
                $problems[] = $clean + ['raw' => array_diff_key($row, ['_line' => 1]), 'errors' => $errors];
            } else {
                $ready[] = $clean;
            }
        }

        // Guru tanpa NIP yang namanya + tgl lahirnya ganda TANPA pembeda → pindahkan ke bermasalah.
        if ($type === Voter::TEACHER) {
            $groups = collect($ready)->whereNull('identifier')
                ->groupBy(fn ($r) => $this->nameKey($r['name'], $r['birth_date']));
            foreach ($groups as $group) {
                if ($group->count() > 1 && $group->contains(fn ($r) => ! $r['distinguisher'])) {
                    $lines = $group->pluck('line')->all();
                    $ready = array_values(array_filter($ready, fn ($r) => ! in_array($r['line'], $lines, true)));
                    foreach ($group as $r) {
                        $problems[] = $r + ['raw' => [], 'errors' => ['Nama + tanggal lahir ganda (baris '.implode(', ', $lines).'); semua wajib diisi kolom kode yang berbeda']];
                    }
                }
            }
        }

        usort($problems, fn ($a, $b) => $a['line'] <=> $b['line']);

        $token = (string) Str::uuid();
        Cache::put($this->cacheKey($token), ['type' => $type, 'rows' => $ready], now()->addMinutes(30));

        return [
            'token' => $token,
            'type' => $type,
            'ready' => $ready,
            'problems' => $problems,
            'summary' => [
                'total' => count($rows),
                'ready' => count($ready),
                'problems' => count($problems),
                'new' => count(array_filter($ready, fn ($r) => $r['action'] === 'baru')),
                'update' => count(array_filter($ready, fn ($r) => $r['action'] === 'perbarui')),
            ],
        ];
    }

    /**
     * Menyimpan baris siap dari pratinjau.
     *
     * @return array{created: int, updated: int}
     */
    public function commit(string $token): array
    {
        $data = Cache::pull($this->cacheKey($token));
        if (! $data) {
            throw new InvalidArgumentException('Pratinjau kedaluwarsa atau tidak ditemukan. Unggah ulang berkas CSV.');
        }

        $type = $data['type'];
        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($data, $type, &$created, &$updated) {
            foreach ($data['rows'] as $row) {
                $attrs = [
                    'name' => $row['name'],
                    'class_name' => $row['class_name'],
                    'birth_date' => $row['birth_date'],
                    'distinguisher' => $row['distinguisher'],
                    'is_active' => true,
                ];

                $query = Voter::where('type', $type)->where('is_simulation', false);
                if ($row['identifier']) {
                    $query->where('identifier', $row['identifier']);
                } else {
                    $query->whereNull('identifier')->where('name', $row['name'])
                        ->whereDate('birth_date', $row['birth_date']);
                    $row['distinguisher']
                        ? $query->where('distinguisher', $row['distinguisher'])
                        : $query->whereNull('distinguisher');
                }

                $voter = $query->first();
                if ($voter) {
                    $voter->fill($attrs)->save();
                    $updated++;
                } else {
                    Voter::create($attrs + ['type' => $type, 'identifier' => $row['identifier']]);
                    $created++;
                }
            }
        });

        return ['created' => $created, 'updated' => $updated];
    }

    /** Terima YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. Kembalikan YYYY-MM-DD atau null. */
    public function normalizeDate(string $raw): ?string
    {
        $raw = trim($raw);
        $formats = ['Y-m-d' => '/^\d{4}-\d{1,2}-\d{1,2}$/', 'd/m/Y' => '/^\d{1,2}\/\d{1,2}\/\d{4}$/', 'd-m-Y' => '/^\d{1,2}-\d{1,2}-\d{4}$/'];

        foreach ($formats as $format => $pattern) {
            if (! preg_match($pattern, $raw)) {
                continue;
            }
            $parts = preg_split('/[\/\-]/', $raw);
            [$y, $m, $d] = $format === 'Y-m-d' ? $parts : [$parts[2], $parts[1], $parts[0]];
            if (! checkdate((int) $m, (int) $d, (int) $y)) {
                return null;
            }
            $date = Carbon::createFromDate((int) $y, (int) $m, (int) $d);
            if ($date->year < 1940 || $date->isFuture()) {
                return null;
            }

            return $date->format('Y-m-d');
        }

        return null;
    }

    /** @return array<int, array<string, string|int>> */
    private function parseCsv(string $csv, string $type): array
    {
        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv); // buang BOM Excel
        $lines = preg_split('/\r\n|\r|\n/', trim($csv));
        if (! $lines || trim($lines[0]) === '') {
            throw new InvalidArgumentException('Berkas CSV kosong.');
        }

        // Excel versi Indonesia sering memakai titik koma.
        $delimiter = substr_count($lines[0], ';') > substr_count($lines[0], ',') ? ';' : ',';
        $header = array_map(fn ($h) => Str::snake(trim(mb_strtolower($h))), str_getcsv($lines[0], $delimiter, '"', ''));
        $header = array_map(fn ($h) => match ($h) {
            'tgl_lahir', 'tanggal_lahir_(yyyy-mm-dd)', 'tanggallahir' => 'tanggal_lahir',
            'name' => 'nama',
            'class', 'rombel' => 'kelas',
            default => $h,
        }, $header);

        $required = array_slice(self::HEADERS[$type], 0, $type === Voter::STUDENT ? 4 : 3);
        $missing = array_diff($required, $header);
        if ($missing) {
            throw new InvalidArgumentException('Kolom wajib tidak ada: '.implode(', ', $missing).'. Header yang diharapkan: '.implode(',', self::HEADERS[$type]));
        }

        $rows = [];
        foreach (array_slice($lines, 1) as $i => $line) {
            if (trim(str_replace($delimiter, '', $line)) === '') {
                continue;
            }
            $values = str_getcsv($line, $delimiter, '"', '');
            $row = ['_line' => $i + 2];
            foreach ($header as $idx => $key) {
                $row[$key] = $values[$idx] ?? '';
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private function nameKey(string $name, ?string $dob): string
    {
        return mb_strtolower(trim($name)).'|'.$dob;
    }

    private function cacheKey(string $token): string
    {
        return 'voter-import:'.$token;
    }
}
