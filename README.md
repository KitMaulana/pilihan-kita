# Pilihan Kita — E-Voting OSIS "One Face One Vote" (SMAN 1 Ciruas)

Pemilihan Ketua OSIS untuk ±1.700 siswa + guru. Pemilih dikenali lewat wajah di tablet (pengenalan di **browser**,
pencocokan 1:N di **server**), mengonfirmasi nama & kelas, lalu memilih. Cadangan: NISN/NIP + tanggal lahir.
Live score agregat, kode resi, ledger berantai hash, laporan akhir.

- Rencana & aturan proyek: [`CLAUDE.md`](CLAUDE.md) · Status: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Deploy Hostinger: [`docs/DEPLOY.md`](docs/DEPLOY.md) · Hari-H: [`docs/RUNBOOK-HARI-H.md`](docs/RUNBOOK-HARI-H.md)
- Privasi & surat persetujuan: [`docs/PRIVASI-DAN-IZIN.md`](docs/PRIVASI-DAN-IZIN.md) · Model wajah: [`public/models/README.md`](public/models/README.md)

## Stack

Laravel 12 · PHP 8.2+ · MySQL/MariaDB · Sanctum · React 19 + Vite + Tailwind 4 · TanStack Query · Zustand ·
`onnxruntime-web` (SCRFD `det_500m` + ArcFace `w600k_mbf`) · `@mediapipe/tasks-vision` (liveness kedip/toleh).

## Menjalankan lokal (Windows/XAMPP)

```powershell
composer install
npm install
copy .env.example .env      # set DB_DATABASE=pilihan_kita, SEED_ADMIN_PASSWORD=...
php artisan key:generate
php artisan migrate --seed  # akun admin/panitia + data contoh (APP_ENV=local)
php artisan storage:link
# unduh model ke public/models/ (lihat README di sana)
php artisan serve           # http://127.0.0.1:8000
npm run dev                 # terminal lain (atau: npm run build)
```

Halaman: `/` beranda · `/hasil` Hitung Langsung · `/resi` cek resi · `/kiosk` tablet · `/kiosk/pasang` pasang token ·
`/panitia` panel (login).

## Perintah penting

| Perintah | Fungsi |
|---|---|
| `php artisan test` | 66+ tes Feature (SQLite in-memory; jalankan `config:clear` dulu) |
| `php artisan votes:verify-ledger` | Verifikasi rantai hash + konsistensi suara vs penanda |
| `php artisan face:benchmark --n=1800` | Ukur waktu pencocokan 1:N |
| `php artisan simulation:create --voters=200 --export=storage/simulation-vectors.json` | Data simulasi (gladi / uji beban) |
| `php artisan simulation:purge` | Hapus bersih data simulasi |
| `php artisan face:purge-all` | Hapus semua template wajah (retensi) |
| `node scripts/loadtest.mjs --base=... --tokens=... --vectors=...` | Uji beban alur kiosk |

## Arsitektur singkat

```
Tablet (Chrome, HTTPS)                      Server Laravel + MySQL
kamera → MediaPipe (liveness)               POST /api/v1/kiosk/identify  → 1:N cosine, ambang + margin
       → SCRFD + ArcFace (ONNX, WASM)  ──►  POST /api/v1/kiosk/fallback  → NISN/NIP + tgl lahir, kunci 3×
       → kirim VEKTOR saja                  POST /api/v1/kiosk/confirm   → tiket sekali pakai
konfirmasi nama → pilih kandidat       ──►  POST /api/v1/kiosk/vote      → transaksi atomik + ledger
                                            GET  /api/v1/public/results  → cache 5 dtk
```
