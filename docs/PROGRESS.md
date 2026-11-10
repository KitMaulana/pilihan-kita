# PROGRESS — E-Voting OSIS "One Face One Vote"

**Fase aktif: 3 (gerbang uji akurasi wajah) — menunggu model + tablet nyata + sukarelawan.**
Terakhir diperbarui: 2026-11-09.

## Ringkasan status per fase

| Fase | Status | Catatan |
|---|---|---|
| 0 Prasyarat | ⏳ di luar kode | Izin kepsek, surat orang tua (draf: `docs/PRIVASI-DAN-IZIN.md`), domain HTTPS, tablet, data pemilih + pas foto |
| 1 Bootstrap | ✅ | Laravel 12.71 + React 19 + Vite 6 + Tailwind 4; Sanctum cookie SPA; peran admin/panitia; seeder akun awal |
| 2 Impor pemilih | ✅ | Pratinjau siap/bermasalah, templat CSV, `DD/MM/YYYY` dinormalisasi, maks 2.000 baris, guru tanpa NIP + kode pembeda, deteksi nol-depan hilang (Excel), titik-koma (Excel ID) |
| 3 Mesin wajah + uji akurasi | 🟡 kode selesai, **uji nyata belum** | `features/face/*`, halaman `/panitia/uji-wajah` (histogram, FAR/FRR, FAR 1:N, simulasi aturan, rekomendasi ambang/margin, waktu proses). **Model InsightFace belum bisa diunduh di mesin dev** (rilis GitHub 504 via proxy) → pipeline deteksi/embedding belum dijalankan dengan model asli |
| 4 Pendaftaran wajah | ✅ (kode) | Unggah banyak berkas/folder, cek 1 wajah/ukuran/buram/gelap, vektor dihitung di browser, foto tidak dikirim, deteksi wajah ganda, laporan gagal, progres x/N |
| 5 API identifikasi & cadangan | ✅ | Aturan §6.3 (ambang + margin), cadangan §6.4, kunci 3× salah, tiket sekali pakai, `access_attempts` dibulatkan menit. **Pencocokan 1.800 template: median ±46 ms** (`php artisan face:benchmark`, PHP 8.2 Windows, tanpa OPcache) |
| 6 UI kiosk | ✅ (kode) | Alur penuh, panduan oval, liveness acak (kedip + toleh + kembali depan), konfirmasi nama+kelas tanpa foto, cadangan ramah sentuh, resi, reset otomatis, layar penuh, wake-lock, mode "tanpa wajah" bila model gagal. Diuji otomatis lewat Chrome headless (alur cadangan → resi) |
| 7 Voting, ledger, resi | ✅ | Transaksi atomik + PK `voter_turnouts` + idempotency. **Uji konkurensi nyata (MariaDB, 10 permintaan paralel token sama) → tepat 1 sukses.** `votes:verify-ledger` |
| 8 Live score & publik | ✅ | Cache 5 dtk + `Cache-Control: public, max-age=5`, polling 5 dtk, label "Diperbarui HH:MM:SS WIB", cek resi, hasil akhir + hash terakhir. 360 px tanpa scroll horizontal |
| 9 Panel panitia | ✅ | Kandidat, jadwal/status (konfirmasi ketik kata), perangkat, buka-kunci, log + ekspor CSV, anomali, pengguna (admin), cetak laporan |
| 10 Pengerasan & uji beban | 🟡 | Rate limit per tablet, header keamanan + CSP produksi, mode simulasi, skrip `scripts/loadtest.mjs`. Uji beban lokal: lihat bawah. **Uji beban di staging Hostinger belum** |
| 11 Deploy & hari-H | 🟡 dokumen siap | `docs/DEPLOY.md`, `docs/RUNBOOK-HARI-H.md`, service worker men-cache `/models/` `/wasm/` `/build/` (bukan API) |

## Keputusan improvisasi (perlu diketahui pemilik)

1. **Penyegelan ledger per batch acak.** Suara baru masuk tanpa nomor urut; tiap `seal_batch_size` (bawaan 10) suara, kelompok itu diacak (CSPRNG) lalu dirantai hash. Alasannya: log percobaan (`voter_id` + menit) bisa dikorelasikan dengan urutan ledger bila urutan = urutan kedatangan. Live score juga hanya menghitung suara tersegel → angka naik per kelompok, sehingga penonton tidak bisa menebak pilihan seseorang dari kenaikan +1 tepat setelah ia memilih. Saat ditutup, sisa suara disegel paksa.
2. **UUIDv4 manual** untuk `votes.id` — trait `HasUuids` Laravel 12 menghasilkan UUIDv7 (memuat waktu).
3. **`voters` tanpa `updated_at`** (jika ada, kolom itu menjadi stempel waktu memilih). Penanda sudah memilih di `voter_turnouts` (PK komposit, tanpa waktu, tanpa auto-increment).
4. **Token tablet = hash SHA-256 di `kiosk_devices.token_hash`** (bukan tabel Sanctum) agar pencabutan langsung & sederhana. Tautan pemasangan memakai fragmen `#token=` agar token tidak tercatat di log server.
5. **Guru tanpa NIP ganda → kolom `distinguisher` (kode guru)** — menjawab keputusan terbuka §13 no. 2; mohon dikonfirmasi.
6. Pemilih yang terkunci di jalur cadangan **tetap boleh masuk lewat wajah** (penguncian melindungi dari penebak tanggal lahir; wajah adalah bukti lebih kuat). Bisa diubah bila tidak disetujui.
7. Antrean suara saat koneksi putus: **kirim ulang otomatis di memori** (idempotency key sama) sampai token kedaluwarsa — tidak disimpan ke penyimpanan tablet demi kerahasiaan pilihan. (Antrean IndexedDB penuh belum dibuat; keputusan §13 no. 3.)
8. Pemilihan otomatis **ditutup oleh scheduler** saat `closes_at` lewat (`election:auto-close` tiap menit).
9. **Model wajah ikut di-commit ke repo publik** (permintaan pemilik 2026-11-10; sebelumnya diputuskan tidak). Hanya 3 berkas terpilih (±20 MB); lisensi InsightFace non-komersial dicatat di `public/models/NOTICE.md`. CLAUDE.md §5.11 diperbarui.
10. Rate limit hasil publik dibuat longgar (1.200/menit per IP) karena banyak penonton berbagi IP wifi sekolah; hasil sudah di-cache.

## Uji yang sudah dijalankan

- `php artisan test` → **66 lulus** (impor, wajah, identifikasi, cadangan & kunci, voting atomik, idempotensi, kerahasiaan skema, ledger & deteksi manipulasi, cache hasil, otorisasi, simulasi, header keamanan, tidak ada vektor di log).
- `npm run build` sukses (build 788 KB; runtime WASM terpisah di `public/wasm/`).
- Uji HTTP end-to-end (login+CSRF → daftar tablet → buka → cadangan → konfirmasi → suara → replay → tolak memilih ulang).
- Chrome headless + CDP: 360 px (beranda, hasil, resi, login, dasbor) tanpa scroll horizontal & tanpa error konsol; alur kiosk lewat klik sampai resi.
- Matematika penjajaran wajah (galat 1e-14) & mesin liveness (foto statis/dua wajah ditolak) — uji Node.
- Uji beban lokal (Apache XAMPP Windows, **tanpa OPcache**, data simulasi 1.700 pemilih): 90 pemilih @ 60/menit + 10 penonton → 0 gagal, ledger valid. Latensi p50 ±7 dtk — **tidak representatif** (tiap request boot Laravel ±0,7 dtk tanpa OPcache; Apache thread-safe Windows). Wajib `php artisan config:cache` di Apache Windows (tanpanya `.env` bocor antar-thread).

## Masalah tersisa / risiko

- 🟠 **Model terpasang (2026-11-09); bentuk keluaran SCRFD & ArcFace sudah dicek cocok dengan kode, tetapi akurasi pada wajah nyata belum diuji.** Kode mengikuti spesifikasi InsightFace (SCRFD: letterbox kiri-atas, (x−127.5)/128, RGB, 2 anchor, stride 8/16/32; ArcFace: penjajaran 5 titik 112×112, (x−127.5)/127.5). Keluaran SCRFD dikenali dari bentuk tensor sehingga tidak bergantung nama/urutan. Verifikasi pertama: buka `/panitia/uji-wajah`, pastikan wajah terdeteksi dan skor orang sama ≫ orang berbeda.
- 🟠 Arah toleh liveness diterima kiri ATAU kanan (menghindari risiko salah pemetaan arah kamera depan). Ambang di `features/face/config.js` (`LIVENESS`) perlu dikalibrasi di tablet nyata.
- 🟠 Video rekaman wajah yang berkedip & menoleh dapat lolos liveness aktif (diterima sebagai risiko sisa; mitigasi: konfirmasi nama, log, anomali, panitia di lokasi).
- 🟠 Performa server sungguhan belum diukur di Hostinger.

## Langkah berikutnya

1. Unduh model resmi (lihat `public/models/README.md`), isi checksum.
2. Fase 3: jalankan `/panitia/uji-wajah` di **tablet nyata** dengan 20–30 sukarelawan; catat waktu deteksi/embedding/landmark di sini; ambil rekomendasi AMBANG & MARGIN → "Simpan ke pengaturan". **Gerbang:** FRR tinggi atau > 3 dtk → evaluasi model/tablet.
3. Konfirmasi keputusan terbuka §13 (kode guru, antrean lokal, jadwal & jumlah tablet, retensi).
4. Deploy staging Hostinger → `scripts/loadtest.mjs` 60/menit dengan data simulasi → catat p50/p95.
5. Gladi bersih (mode simulasi) di 3 tablet → hapus simulasi → hari-H sesuai `docs/RUNBOOK-HARI-H.md`.

## Akun lokal (dev)

**admin / adminkita** (login boleh dengan username atau email), panitia / panitia12345 (lokal). Sandi bawaan admin `adminkita` lemah — **ganti di menu Pengguna atau isi `SEED_ADMIN_PASSWORD` sebelum `db:seed` di produksi.**
