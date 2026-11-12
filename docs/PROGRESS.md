# PROGRESS — E-Voting OSIS "One Face One Vote"

**Fase aktif: 3 (gerbang uji akurasi wajah) — menunggu model + tablet nyata + sukarelawan.**
Terakhir diperbarui: 2026-11-12.

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

1. **Penyegelan ledger per batch acak** *(sejak 2026-11-11 hanya untuk urutan ledger; hasil langsung real-time — lihat revisi alur)*. Suara baru masuk tanpa nomor urut; tiap `seal_batch_size` (bawaan 10) suara, kelompok itu diacak (CSPRNG) lalu dirantai hash. Alasannya: log percobaan (`voter_id` + menit) bisa dikorelasikan dengan urutan ledger bila urutan = urutan kedatangan. Live score juga hanya menghitung suara tersegel → angka naik per kelompok, sehingga penonton tidak bisa menebak pilihan seseorang dari kenaikan +1 tepat setelah ia memilih. Saat ditutup, sisa suara disegel paksa.
2. **UUIDv4 manual** untuk `votes.id` — trait `HasUuids` Laravel 12 menghasilkan UUIDv7 (memuat waktu).
3. **`voters` tanpa `updated_at`** (jika ada, kolom itu menjadi stempel waktu memilih). Penanda sudah memilih di `voter_turnouts` (PK komposit, tanpa waktu, tanpa auto-increment).
4. **Token tablet = hash SHA-256 di `kiosk_devices.token_hash`** (bukan tabel Sanctum) agar pencabutan langsung & sederhana. Tautan pemasangan memakai fragmen `#token=` agar token tidak tercatat di log server.
5. **Guru tanpa NIP ganda → kolom `distinguisher` (kode guru)** — menjawab keputusan terbuka §13 no. 2; mohon dikonfirmasi.
6. Pemilih yang terkunci di jalur cadangan **tetap boleh masuk lewat wajah** (penguncian melindungi dari penebak tanggal lahir; wajah adalah bukti lebih kuat). Bisa diubah bila tidak disetujui.
7. Antrean suara saat koneksi putus: **kirim ulang otomatis di memori** (idempotency key sama) sampai token kedaluwarsa — tidak disimpan ke penyimpanan tablet demi kerahasiaan pilihan. (Antrean IndexedDB penuh belum dibuat; keputusan §13 no. 3.)
8. Pemilihan otomatis **ditutup oleh scheduler** saat `closes_at` lewat (`election:auto-close` tiap menit).
9. **Model wajah ikut di-commit ke repo publik** (permintaan pemilik 2026-11-10; sebelumnya diputuskan tidak). Hanya 3 berkas terpilih (±20 MB); lisensi InsightFace non-komersial dicatat di `public/models/NOTICE.md`. CLAUDE.md §5.11 diperbarui.
10. Rate limit hasil publik dibuat longgar (1.200/menit per IP) karena banyak penonton berbagi IP wifi sekolah; hasil sudah di-cache.

## Revisi pemilik 2026-11-10

1. **Jadwal & Status:** transisi baru **Draf → Ditutup** (tutup/batalkan draf meski belum ada kandidat/pemilih). Panel status berupa stepper; tombol Buka / Tutup / Publikasikan selalu tampil (yang tidak berlaku dinonaktifkan + alasan). Pemilihan baru boleh dibuat bila yang sekarang ditutup **tanpa suara** (`can_create_new`, `votes_count` di `ElectionResource`).
2. **Pemilih:** input satuan `POST /panitia/voters` (`VoterStoreRequest` + `VoterImportService::createOne`, aturan sama dengan impor: NISN 10 digit, NIP 18 digit/kosong, guru tanpa NIP wajib kode bila nama+tgl lahir ganda). Tombol "Simpan & tambah lagi" mempertahankan jenis & kelas. Saat mode simulasi aktif, pemilih baru ikut ditandai simulasi.
3. **Bug kandidat:** penyebab = nomor urut berawalan nol (`01`) ditolak `integer` + pesan Inggris (tidak ada berkas terjemahan). Perbaikan: normalisasi nomor di `CandidateRequest`, input nomor hanya angka + validasi di klien, pratinjau foto & cek ukuran ≤ 2 MB sebelum kirim, `lang/id/validation.php`. **Foto kandidat kini dilayani lewat `GET /api/v1/public/candidates/{id}/photo`** (tidak butuh symlink `public/storage` maupun APP_URL yang benar di Hostinger).
4. **Uji Wajah:** tab "Uji cepat" (unggah foto acuan → "Mulai scan wajah" → hasil Cocok / Ambigu / Tidak cocok memakai ambang & margin pengaturan, skor per foto, waktu proses, liveness opsional, simpan ke data akurasi) + tab "Uji akurasi (lanjutan)" (alat lama).

5. **Reset semua suara (2026-11-11, khusus admin)** — menu Jadwal & Status → "Reset suara (uji coba)". `POST /panitia/election/reset-votes` (`VoteResetService`), konfirmasi ketik `RESET SUARA`. Menghapus suara + ledger + tiket + penanda sudah memilih, `has_voted` dikembalikan; opsional hapus log percobaan & buka kunci pemilih. Pemilih, kandidat, wajah, jadwal, status tetap. Ditolak bila `published`. Tercatat `votes.reset_all`. **Pembatalan satu suara (via kode resi) belum dibuat** — menunggu keputusan pemilik; pembatalan per nama pemilih tidak mungkin karena `votes` sengaja tanpa identitas (§5.2).

## Revisi alur 2026-11-11 — CHECK-IN → BILIK SUARA (keputusan pemilik)

- **Dua jenis perangkat** (`kiosk_devices.role`): **Meja check-in** (`/kiosk`) = scan wajah / NISN → konfirmasi nama → *check-in*; **Bilik suara** (`/bilik`) = hanya surat suara. Middleware `kiosk.role:*` memisahkan endpoint (bilik tidak bisa identify/fallback; check-in tidak bisa melihat surat suara/vote).
- **Check-in** (`POST /kiosk/confirm` accepted) dalam satu transaksi: `voter_turnouts` + `has_voted` + satu **hak masuk bilik anonim** (`booth_credits`: UUIDv4, `election_id`, `queued_at` untuk urutan FIFO — tanpa voter_id/device_id/created_at). **Tidak hangus oleh waktu** (keputusan pemilik 2026-11-11: yang sudah check-in pasti memilih); tidak ada pengaturan batas waktu.
- **Bilik**: `GET /kiosk/booth/status` (polling 3 dtk) → surat suara tampil bila ada hak masuk → `POST /kiosk/vote {candidate_id, idempotency_key}` memakai hak masuk tertua (FIFO, `FOR UPDATE`), sisipkan suara, hapus hak masuk. Resi tampil 8 dtk lalu kembali otomatis. Suara tanpa check-in → 409 `no_checkin`.
- **Hasil langsung real-time**: `ResultService` menghitung semua suara (tidak lagi menunggu segel). Segel batch tetap jalan di belakang hanya untuk mengacak urutan ledger. Cache 5 dtk tetap.
- **Rekonsiliasi ledger** baru: `suara + hak masuk belum terpakai = jumlah check-in`. Penutupan TIDAK menghapus hak masuk (admin yang membuka kembali melanjutkan antrean); panel Jadwal memperingatkan bila masih ada yang check-in tetapi belum memilih. Reset suara ikut mengosongkan antrean. Dasbor: "Sudah check-in", "Antre di bilik".
- **Risiko sisa (diterima pemilik):** live score real-time + urutan bilik ≈ urutan check-in → pengamat yang melihat siapa masuk bilik lalu memantau live score saat itu bisa menebak pilihan bila antrean sepi. Mitigasi praktis: layar live score jangan diletakkan di area bilik; ≥2 bilik.
- **Deploy:** wajib `php artisan migrate --force` (tabel `booth_credits`, kolom `role`). Perangkat lama otomatis berperan **meja check-in**; laptop bilik harus didaftarkan baru dengan peran **Bilik suara**.
- `scripts/loadtest.mjs` kini butuh `--tokens=<check-in>` dan `--booths=<bilik>`.

## Revisi 2026-11-12 — MULTI-SEKOLAH (sesi) + branding

- **Sesi = satu pemilihan untuk satu sekolah** (`elections.school_name`, `elections.slug`). Banyak sesi boleh berjalan bersamaan; masing-masing punya status, jadwal, kandidat, pemilih, wajah, tablet, ledger, dan hasil sendiri.
- **Data per sesi:** `voters.election_id` (NISN/NIP unik **per sesi**), `kiosk_devices.election_id`, `activity_logs.election_id`. Pencocokan wajah 1:N & deteksi wajah ganda hanya di dalam sesi yang sama (cache matriks per sesi, berversi).
- **Konteks sesi per request** (`Election::current()`): panel → header `X-Session-Id` (middleware `panitia.session`); tablet → sesi tempat perangkat didaftarkan (`kiosk.device`); di-reset tiap request API (`ResetCurrentElection`).
- **Akses:** admin = semua sesi, membuat/menghapus sesi (menu **Sesi Sekolah**). Panitia bisa **dibatasi ke satu sekolah** (`users.election_id`, menu Pengguna) → meminta sesi lain = 403, ID pemilih/perangkat sekolah lain = 404.
- **Publik:** `/hasil` = daftar sekolah (draf tidak tampil), `/hasil/{slug}` = hasil per sekolah; `GET /public/sessions`, `GET /public/results?session=slug` (tanpa slug: sesi yang dibuka/terbaru, kompatibel tautan lama). Beranda menampilkan "Sekolah peserta".
- **Lainnya:** hapus sesi hanya bila belum ada check-in/suara; retensi wajah per sesi; simulasi = sesi tersendiri (tidak lagi diblokir saat sesi nyata dibuka); `election:auto-close` & `votes:seal` untuk semua sesi.
- **Migrasi `2026_11_12_000100_multi_school_sessions`** mengisi data lama otomatis: sesi lama → "SMAN 1 Ciruas" (tautan `/hasil/sman-1-ciruas`), pemilih & tablet lama ikut. Diuji di MySQL: naik, turun (rollback), dan backfill dengan data.
- **Pemesanan hak masuk oleh bilik (2026-11-12):** surat suara hanya tampil di bilik yang berhasil *memesan* satu hak masuk (`booth_credits.claimed_by` = perangkat bilik; tetap anonim, tanpa voter_id). `POST /kiosk/booth/claim` (idempoten, satu bilik satu pesanan, serial per bilik) dan `GET /kiosk/booth/status` (detak + apakah masih memegang). Dengan N check-in, paling banyak N bilik yang menyala; bilik lain tetap di layar tunggu dan kembali ke layar tunggu otomatis setelah memilih bila tidak ada hak masuk bebas. Suara memakai hak masuk milik bilik pengirim (cadangan: yang masih antre; tidak pernah mencuri pesanan bilik lain). Pesanan dilepas bila bilik tidak terlihat > 2 menit (batas untuk PERANGKAT, bukan pemilih). Dasbor: "N sedang di bilik · M menunggu bilik kosong". Diuji paralel di MySQL: 10 bilik serentak, 5 hak masuk → tepat 5 menyala, 5 bilik berbeda.
- **Panitia terikat ke satu sekolah (2026-11-12):** akun panitia WAJIB punya sekolah (`users.election_id`); admin = semua sekolah. Panitia tanpa sekolah **tidak punya akses apa pun** (403 `no_school` + layar penjelasan), bukan lagi "semua sekolah" (celah yang ditutup). Form Pengguna mewajibkan memilih sekolah untuk panitia; memindahkan/menghapus sekolah ditangani (hapus sesi → panitianya terkunci sampai ditugaskan ulang). Sekolah tampil di sidebar, header, kartu pengguna, dan dasbor. Migrasi `assign_existing_panitia_to_school`: bila hanya ada satu sesi nyata, panitia lama otomatis ditugaskan ke sana.
- **Hapus sesi selesai beserta seluruh datanya (2026-11-12):** admin dapat menghapus sesi sekolah yang berstatus draf/ditutup/dipublikasikan (BUKAN yang sedang dibuka) — dari kartu **Sesi Sekolah** atau panel Jadwal. `SessionDeletionService` menghapus dalam satu transaksi: suara & ledger, check-in, antrean bilik, tiket, pemilih + template wajah, kandidat + foto, perangkat (token langsung tidak berlaku), log percobaan akses & log aktivitas sesi (memuat nama/NISN). Akun panitia dipertahankan tetapi dilepas dari sekolah (terkunci sampai ditugaskan ulang). Hasil publik `/hasil/{slug}` ikut hilang. Konfirmasi wajib mengetik **"HAPUS {NAMA SEKOLAH}"** (bukan kata umum) agar sekolah yang salah tidak terhapus. Catatan penghapusan (`election.deleted`, tanpa data pemilih) tetap ada di log. Sekolah lain tidak tersentuh (diuji, termasuk di MySQL dengan kunci asing sungguhan). Aturan lama "hanya bila belum ada suara" dicabut.
- **Skema surat suara per sekolah (2026-11-12):** `elections.settings.ballot_mode` = `pair` (ketua & wakil satu pasangan, bawaan & data lama) atau `separate` (ketua & wakil dipilih terpisah). Dipilih saat membuat sesi atau di Jadwal (hanya saat draf; tidak bisa diganti bila masih ada kandidat skema lama). Kandidat berjabatan `pair`/`ketua`/`wakil`, nomor urut unik per jabatan. Bilik skema terpisah: langkah 1 Ketua → langkah 2 Wakil (bisa "Ubah") → satu konfirmasi berisi keduanya; dikirim bersama (`choices`) dalam satu transaksi, satu hak masuk, **satu resi** (dua baris `votes` berjabatan berbeda dengan resi sama; unik `receipt_code+position`). Buka pemilihan butuh ≥1 calon aktif di setiap jabatan. Rekonsiliasi ledger per jabatan (suara jabatan + hak masuk tersisa = check-in), mendeteksi surat suara tidak lengkap. Hasil publik, dasbor, dan laporan cetak dipisah per jabatan dengan total masing-masing; "suara terhitung" = jumlah surat suara.
- **Laporan hasil PDF A4 (2026-11-12):** `ReportPdfService` (dompdf ^3.1 — satu-satunya dependensi baru, atas izin pemilik) membuat PDF A4 potret siap cetak: kop logo CiptaKita, perolehan per jabatan + total, partisipasi, verifikasi ledger + hash akhir, tanda tangan Ketua Panitia/Kepala Sekolah, nomor halaman; muat satu lembar (skema berpasangan maupun terpisah). Belum dipublikasikan → ditandai "HASIL SEMENTARA", tanpa penanda pemenang. Panel: `GET /panitia/election/report/pdf` (tombol "Unduh PDF (A4)" / "Lihat & cetak" di Jadwal & Status; tercatat di log). Publik: `GET /public/results/pdf?session=slug` hanya bila `published` (cache 60 dtk, throttle) + tombol di halaman hasil akhir. Tidak memuat identitas pemilih maupun kode resi. Menggantikan cetak HTML lama.
- **Pagination:** daftar pemilih, log percobaan, dan log aktivitas dipaginasi di server (maks. 200/halaman) dan tampilan; ukuran halaman pemilih kini bisa dipilih (25/50/100/200).
- **Catatan lingkungan (Windows):** setelah `composer require`, folder `bootstrap/cache` sempat bertanda ReadOnly sehingga `artisan` gagal ("must be present and writable"); diperbaiki dengan `attrib -R bootstrap\cache`. Di Hostinger: setelah `composer install --no-dev`, pastikan `bootstrap/cache` dan `storage` writable (chmod 775).
- **Branding:** "SMAN 1 Ciruas" dihapus dari header/judul/manifes (nama sekolah kini dinamis per sesi); skala `BrandLogo` diperbesar (xs h-9, sm h-11, md h-14, lg h-16, xl h-20).
- **Dasbor:** bila API gagal kini menampilkan pesan + petunjuk (`migrate --force`, `config:cache`, log) alih-alih layar kosong. Penyebab paling mungkin error di hosting sebelumnya: migrasi `booth_credits` belum dijalankan.

## Uji yang sudah dijalankan

- `php artisan test` → **119 lulus** (2026-11-12, + laporan PDF A4) (impor, wajah, identifikasi, cadangan & kunci, voting atomik, idempotensi, kerahasiaan skema, ledger & deteksi manipulasi, cache hasil, otorisasi, simulasi, header keamanan, tidak ada vektor di log).
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
