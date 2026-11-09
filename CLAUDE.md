# PANDUAN BUILD — E-Voting OSIS "One Face One Vote" SMAN 1 Ciruas

> File ini adalah **peta kerja untuk Claude Code di VS Code**.
> Cara pakai: salin file ini ke folder proyek BARU (mis. `C:\xampp\htdocs\PEMILIHAN-OSIS\`), ganti namanya menjadi `CLAUDE.md`
> (atau simpan sebagai `docs/PANDUAN.md` dan impor dari `CLAUDE.md` dengan `@docs/PANDUAN.md`).
> Bahasa komunikasi: **Bahasa Indonesia**. Bahasa kode (class, variabel, kolom DB): **Inggris**.
> Status: **RENCANA — belum ada kode.** Semua angka performa di bawah adalah estimasi sampai diukur (lihat Fase 3).

---

## 0. Cara memakai di Claude Code (urutan kerja)

1. Buat folder proyek baru, buka di VS Code, jalankan Claude Code di terminal VS Code (PowerShell).
2. Taruh file ini sebagai `CLAUDE.md`. Buat juga `docs/PROGRESS.md` kosong (judul + "Fase aktif: 0").
3. Untuk **setiap fase**: tekan **Shift+Tab → plan mode**, tempel "Prompt untuk Claude Code" fase tersebut, setujui rencananya, baru eksekusi.
4. Selesai satu fase → jalankan tes → perbarui `docs/PROGRESS.md` → **commit** (`feat: ...`) → baru lanjut fase berikutnya.
5. Jangan loncat fase. Fase 3 (uji akurasi wajah) adalah **gerbang**: bila akurasinya tidak memadai, hentikan dan putuskan ulang.
6. Gunakan `/compact` bila percakapan panjang (pastikan `PROGRESS.md` sudah diperbarui dulu).

### Prompt pembuka (tempel SEKALI di awal sesi pertama)

```
Baca CLAUDE.md sampai habis (terutama §2 keputusan final, §3 koreksi teknis, §5 aturan emas, §6 arsitektur, §7 fase).
Lalu baca docs/PROGRESS.md. Jangan menulis kode dulu.
Ringkas pemahamanmu dalam 10 poin, sebutkan hal yang masih ambigu atau bertentangan,
dan usulkan rencana untuk Fase 1 (daftar file yang akan dibuat). Tunggu persetujuan saya.
Aturan kerja: Bahasa Indonesia; kerjakan satu fase satu waktu; jangan loncat fase;
jangan menambah dependensi di luar §4 tanpa izin; jangan commit model .onnx, .env, atau data pemilih.
```

### Prompt untuk sesi baru / setelah /compact

```
Baca CLAUDE.md dan docs/PROGRESS.md. Lanjutkan dari "Langkah berikutnya" di PROGRESS.md.
Tunjukkan rencana fase aktif dulu sebelum menulis kode.
```

---

## 1. Ringkasan proyek

Aplikasi pemilihan Ketua OSIS SMAN 1 Ciruas.
- **Pemilih:** ±1.700 siswa + guru, satu orang satu suara.
- **Identifikasi:** pemilih berdiri di depan kamera tablet → sistem mengenali wajahnya (1:N dari seluruh daftar pemilih) → konfirmasi nama & kelas → memilih. Mirip gate KRL.
- **Cadangan bila wajah gagal:** siswa = **NISN + tanggal lahir**; guru = **NIP + tanggal lahir** (guru tanpa NIP: **nama + tanggal lahir**).
- **Transparansi:** live score selama voting (angka agregat), kuota partisipasi, kode resi per pemilih, ledger berantai hash, laporan akhir.
- **Perangkat:** 3 (atau lebih) tablet/HP Android, dibuka di Chrome sebagai **web/PWA** (bukan APK).
- **Hosting:** Hostinger shared (PHP + MySQL), **full online**. Tidak ada Python di server.

---

## 2. Keputusan yang SUDAH final (jangan diubah tanpa izin pemilik)

| # | Keputusan |
|---|---|
| 1 | Pengenalan wajah dijalankan **di browser** (ONNX Runtime Web). Server hanya menerima **vektor** dan membandingkan. |
| 2 | Bentuk aplikasi: **web/PWA**, kiosk di Chrome. Bukan APK (APK/Capacitor hanya jika PWA terbukti bermasalah). |
| 3 | Pencocokan **1:N di server**; template wajah **tidak pernah dikirim ke tablet**. |
| 4 | Layar konfirmasi menampilkan **nama + kelas**, **tanpa foto**. |
| 5 | Foto pas diunggah panitia → diubah jadi vektor → **foto dihapus**; yang disimpan hanya vektor. |
| 6 | Cadangan: NISN/NIP + tanggal lahir. Guru tanpa NIP: nama + tanggal lahir. **Tanpa pengawasan panitia**; pengaman = batas percobaan, sekali pakai, log. |
| 7 | **Live score tampil selama voting** (agregat per kandidat). Tidak ada rincian per kelas/jam secara live. |
| 8 | Suara **rahasia**: tabel suara tidak menyimpan identitas pemilih. |
| 9 | Hasil = **real count** seluruh pemilih (bukan sampel; jangan disebut "quick count" di UI — pakai "Hitung Langsung"). |

---

## 3. Koreksi teknis penting (hasil review — baca!)

- **Ukuran model:** model ArcFace `w600k_r50` (paket `buffalo_l`) ±170 MB → **terlalu berat** untuk tablet. Gunakan **MobileFaceNet `w600k_mbf`** (paket `buffalo_s`, ±13 MB) + detektor **`det_500m`** (±2,5 MB). Total unduhan pertama (model + WASM runtime) diperkirakan **±30–50 MB**, sekali saja lalu di-cache. *Verifikasi ukuran & nama file saat mengunduh.*
- **Lisensi:** model pra-latih InsightFace berlisensi **non-komersial/riset**. Pemilihan OSIS non-komersial, tetapi **minta persetujuan tertulis kepala sekolah** dan catat sumber model. Alternatif lisensi lebih longgar bisa dievaluasi di Fase 3.
- **Liveness:** model Silent-Face-Anti-Spoofing berformat PyTorch (butuh konversi ONNX). Untuk browser, **liveness aktif (kedip / tolehkan kepala) memakai MediaPipe Face Landmarker** lebih mudah dan transparan bagi pemilih. Liveness pasif boleh ditambah bila terbukti bisa dikonversi & akurat.
- **FAR pada 1:N:** dengan ±1.800 template, peluang salah-cocok terhadap *salah satu* orang ≈ 1.800 × FAR per-pembanding. Karena itu aturan keputusan wajib **ambang ketat + selisih margin dengan peringkat 2 + konfirmasi nama oleh pemilih + fallback**. Ambang dicari lewat uji (Fase 3), bukan angka tebakan.
- **Kepercayaan klien:** vektor dihitung di browser yang bisa dimanipulasi. Mitigasi: hanya **tablet terdaftar** (device token), batas laju, dan log audit (Fase 9–10).

---

## 4. Stack

- Backend: **Laravel 12**, PHP 8.2+/8.3, **MySQL**, **Sanctum** (panitia/admin = login; tablet = device token ability `kiosk`).
- Frontend: **React + Vite + Tailwind CSS**, Axios, TanStack Query, Zustand, React Router. SPA satu repo dengan Laravel.
- Wajah di browser: **`onnxruntime-web`** (deteksi + embedding), **`@mediapipe/tasks-vision`** (liveness aktif).
- Tes: PHPUnit (Feature Test minimal satu per endpoint), uji manual browser desktop + tablet.
- Tidak boleh menambah dependensi besar lain tanpa izin pemilik.

Perintah awal (PowerShell):

```powershell
composer create-project laravel/laravel pemilihan-osis
cd pemilihan-osis
php artisan install:api
npm install
npm install react react-dom react-router-dom axios @tanstack/react-query zustand onnxruntime-web @mediapipe/tasks-vision
npm install -D @vitejs/plugin-react tailwindcss @tailwindcss/vite
```

---

## 5. Aturan emas

1. **Backend adalah sumber kebenaran.** Keputusan "boleh memilih / sudah memilih / cocok atau tidak" dibuat server.
2. **Kerahasiaan suara:** tabel `votes` tidak punya `voter_id`/NISN/NIP, tidak ada timestamp presisi, memakai ID acak (UUIDv4, bukan auto-increment). Penandaan "sudah memilih" ada di tabel terpisah tanpa urutan waktu presisi. Penulisan keduanya dalam **satu transaksi DB**.
3. **Satu orang satu suara** dijamin oleh **unique constraint** di database + transaksi atomik + idempotency key (bukan hanya cek di PHP).
4. **Template wajah = data biometrik.** Jangan di-log, jangan masuk respons API selain ke panitia berwenang (dan tetap jangan dikirim ke tablet). Jangan ikut di backup publik.
5. Foto pas **dihapus** setelah vektor tersimpan. Tidak ada foto wajah di `storage/public`.
6. Semua endpoint kiosk wajib melewati: **device token valid + jam voting terbuka + batas laju**.
7. Validasi via Form Request, respons via API Resource, logika di Service class, controller tipis.
8. **Mobile/tablet-first:** uji lebar 360px & tablet 800–1280px, orientasi potret & lanskap.
9. Teks UI Bahasa Indonesia baku; waktu disimpan UTC, tampil `Asia/Jakarta`.
10. Dilarang `migrate:fresh` / `db:seed` ulang di produksi. Dilarang menghapus data di luar cakupan tugas.
11. Kunci rahasia & `.env` tidak masuk Git. Model `.onnx` **tidak masuk Git** (unggah manual ke server).

---

## 6. Arsitektur

```
Tablet (Chrome PWA, HTTPS)                         Hostinger (Laravel + MySQL)
 ├─ kamera depan                                    ├─ voters (+ face_templates terpisah)
 ├─ deteksi + liveness + embedding (browser)  ───►  ├─ POST /kiosk/identify   (cocokkan 1:N)
 ├─ kirim VEKTOR (bukan gambar)                     ├─ POST /kiosk/fallback   (NISN/NIP + tgl lahir)
 └─ layar konfirmasi → pilih kandidat         ───►  ├─ POST /kiosk/vote       (token sekali pakai)
                                                    └─ GET  /public/results   (snapshot cache 5 dtk)
Browser panitia: impor CSV pemilih, unggah pas foto (vektor dibuat di browser), panel kontrol.
```

### 6.1 Struktur folder yang direncanakan

```
resources/js/
├─ app/ (router, providers)
├─ pages/kiosk/ (KioskPage, KonfirmasiPage, PilihKandidatPage, SelesaiPage)
├─ pages/panitia/ (Dashboard, Pemilih, UnggahFoto, Kandidat, Perangkat, Log, Jadwal)
├─ pages/publik/ (HasilLangsung, CekResi)
├─ features/face/ (faceEngine.js, useCamera.js, liveness.js, align.js)
└─ lib/ (api.js, device.js)
public/models/         ← .onnx diunggah MANUAL, masuk .gitignore
app/Services/ (VoterImportService, FaceMatchService, VoteService, ResultService, AuditService)
```

### 6.2 Model data (ringkas)

- `voters`: id, type (`student`/`teacher`), identifier (NISN/NIP, nullable utk guru tanpa NIP), name, class_name (nullable), birth_date, is_active, has_voted (bool; **tanpa timestamp presisi**).
- `face_templates`: voter_id (unique), embedding (BLOB float32 ×512, ternormalisasi), model_version, quality_score.
- `candidates`: number, name, class_name, photo_path, vision, mission, is_active.
- `elections`: name, status (`draft|open|closed|published`), opens_at, closes_at, settings (ambang, margin, batas percobaan).
- `votes`: id (UUIDv4), election_id, candidate_id — **tanpa identitas**; `receipt_code` (acak, unik), `prev_hash`, `hash`.
- `kiosk_devices`: name, token_hash, is_active, last_seen_at.
- `access_attempts`: voter_id (nullable), device_id, method (`face|fallback`), result, reason, created_at (dibulatkan menit).
- `activity_logs`: aksi panitia (impor, unggah foto, buka-kunci, ubah jadwal).

### 6.3 Aturan keputusan wajah (server)

1. Hitung cosine similarity vektor masuk ke semua template aktif → ambil skor tertinggi `s1` dan kedua `s2`.
2. Cocok bila `s1 ≥ AMBANG` **dan** `s1 − s2 ≥ MARGIN`. Lainnya → "tidak dikenali" → cadangan.
3. Cocok tetapi `has_voted = true` → tolak dengan pesan jelas, catat.
4. Balas hanya `{ voter_ref (token sesi), name, class_name }`.
5. Pemilih menekan **Ya** → server menerbitkan **token suara sekali pakai** (kedaluwarsa pendek, mis. 3 menit). **Tidak** → cadangan.
6. Penyimpanan vektor: BLOB biner (`pack('f*')`), dimuat ke cache file Laravel; opsional kuantisasi int8 bila lambat. Hitungan 1.800×512 di PHP ≈ puluhan ms (ukur di Fase 5).

### 6.4 Cadangan

- Cocokkan `identifier` + `birth_date`; guru tanpa NIP: `name` + `birth_date` (harus **unik**, bila ganda → tolak & beri tahu panitia menambah pembeda).
- **3 percobaan salah → terkunci** per pemilih sampai panitia buka-kunci. Batas laju per perangkat juga.
- Semua percobaan (berhasil/gagal) masuk `access_attempts`.
- Bila liveness gagal di jalur wajah → arahkan ke cadangan **dan** catat sebagai kejadian mencurigakan.

### 6.5 Suara, resi, ledger

- Token suara + `idempotency_key` → `VoteService::cast()` dalam satu transaksi: kunci baris `voters` (`FOR UPDATE`), pastikan `has_voted=false`, tulis `votes` (UUID acak + `receipt_code`), set `has_voted=true`.
- **Ledger berantai:** `hash = sha256(prev_hash | candidate_id | receipt_code | nonce)`. Hash terakhir dipublikasikan saat penutupan.
- **Halaman cek resi (publik):** memasukkan kode resi hanya menjawab **"tercatat di ledger"** — **tidak** menampilkan pilihan (mencegah paksaan/jual-beli suara).

### 6.6 Live score & Hitung Langsung

- `GET /api/v1/public/results` → agregat per kandidat + total sudah memilih / total pemilih (siswa & guru terpisah). **Tanpa** rincian per kelas/jam.
- `Cache::remember` TTL 5 detik, header `Cache-Control: public, max-age=5`. Frontend polling 5 detik (TanStack Query). Tanpa WebSocket (cukup untuk shared hosting).
- Setelah ditutup: status `closed` → verifikasi ledger → `published` (laporan akhir + hash terakhir).

---

## 7. Fase pengerjaan

> Setiap fase: ✅ kriteria selesai, 📝 prompt untuk Claude Code (tempel di plan mode).

### Fase 0 — Prasyarat (di luar kode, Anda yang urus)
- [ ] Izin kepala sekolah & **surat persetujuan orang tua/wali** untuk data wajah (lihat §10).
- [ ] Konfirmasi lisensi model; putuskan model pengganti bila perlu.
- [ ] Domain HTTPS di Hostinger siap (mis. `pemilihan.ciptakita.id`); akses SSH/Git.
- [ ] 3–5 tablet Android dengan kamera depan layak; hotspot cadangan; lampu penerang.
- [ ] Daftar pemilih (siswa & guru) + pas foto.

### Fase 1 — Bootstrap proyek
✅ Laravel + React + Tailwind jalan; login panitia/admin; seeder akun awal; `php artisan test` & `npm run build` lulus; halaman `/` placeholder.
📝 *"Baca CLAUDE.md. Kerjakan Fase 1: bootstrap Laravel 12 + React/Vite/Tailwind sesuai §4 & §6.1, autentikasi panitia (Sanctum, role `admin`/`panitia`), seeder akun awal, tes login. Buat rencana dulu."*

### Fase 2 — Data pemilih & impor massal
✅ Impor CSV siswa (`nisn,nama,kelas,tanggal_lahir`) dan guru (`nip,nama,tanggal_lahir`) dengan **pratinjau** baris siap/bermasalah (duplikat, tanggal salah, kosong); templat CSV bisa diunduh; format tanggal `YYYY-MM-DD` (terima juga `DD/MM/YYYY` dengan normalisasi); maks. 2.000 baris; guru tanpa NIP didukung (deteksi nama+tgl lahir ganda); daftar pemilih bisa dicari/difilter; tes Feature.
📝 *"Fase 2: tabel `voters`, `VoterImportService`, endpoint impor dengan pratinjau + konfirmasi, halaman panitia 'Pemilih'. Pola impor-dengan-pratinjau ikuti gaya yang sudah umum (baris siap vs bermasalah dengan alasan)."*

### Fase 3 — Mesin wajah di browser + **UJI AKURASI (gerbang)**
✅ Halaman uji `/panitia/uji-wajah`: kamera → deteksi → liveness aktif → embedding → tampil vektor & skor; model dimuat dari `public/models/` dan di-cache; **laporan akurasi** (genuine vs impostor, FAR/FRR, histogram skor) dari 20–30 sukarelawan; rekomendasi AMBANG & MARGIN; waktu proses per langkah di tablet nyata diukur dan dicatat di `PROGRESS.md`.
Gerbang: jika FRR terlalu tinggi atau waktu >3 detik di tablet → hentikan, evaluasi model/tablet.
📝 *"Fase 3: implementasikan `features/face/` (onnxruntime-web: det_500m + w600k_mbf, MediaPipe liveness kedip/toleh), halaman uji akurasi, alat hitung FAR/FRR & rekomendasi ambang. Model diunduh manual dari sumber resmi ke `public/models/` (di .gitignore) — tulis README langkah unduh + checksum. Jangan commit model."*

### Fase 4 — Pendaftaran wajah (unggah pas foto oleh panitia)
✅ Unggah foto per pemilih atau massal (nama berkas = NISN/NIP, atau zip); per foto diperiksa: tepat 1 wajah, ukuran wajah memadai, tidak buram/gelap; vektor dihitung di browser lalu dikirim; **foto tidak disimpan di server**; deteksi **wajah ganda** (dua pemilih berbeda dengan vektor nyaris sama → tandai); daftar foto gagal dengan alasan; progres "x dari N terdaftar wajah"; tes Feature endpoint penyimpanan template.
📝 *"Fase 4: `face_templates`, endpoint simpan template (validasi dimensi 512, norma ≈1, model_version), halaman 'Unggah Foto' dengan pemrosesan di browser + laporan kualitas, deteksi duplikat wajah."*

### Fase 5 — API identifikasi & cadangan
✅ `/kiosk/identify` (aturan §6.3), `/kiosk/fallback` (§6.4), pembatasan percobaan & kunci, `access_attempts`, jendela waktu voting, token suara sekali pakai; **ukur** waktu pencocokan untuk 1.800 template (target <200 ms); tes Feature lengkap (cocok, ambigu, sudah memilih, terkunci, di luar jam, guru tanpa NIP).
📝 *"Fase 5: `FaceMatchService`, `KioskController` tipis, Form Request, API Resource, penguncian, tes. Ukur performa dan catat."*

### Fase 6 — UI kiosk (tablet)
✅ Alur penuh sesuai §1: kamera + panduan ("dekatkan wajah", "hanya satu orang"), progres liveness, konfirmasi nama+kelas, tombol cadangan jelas, layar pilih kandidat besar & ramah sentuh, layar selesai + **kode resi**, kembali ke awal otomatis (reset sesi, bersihkan state/kamera); mode kiosk layar penuh; tampil benar di 360px & tablet; halaman error ramah (koneksi putus, kamera ditolak).
📝 *"Fase 6: halaman kiosk React di bawah `pages/kiosk/`, state Zustand, device token dari `lib/device.js`, teks Indonesia baku, tombol ≥48px."*

### Fase 7 — Voting, kerahasiaan, ledger, resi
✅ `VoteService::cast()` transaksional (§6.5), idempotensi, tes konkurensi (dua permintaan bersamaan hanya satu sukses), `receipt_code`, ledger berantai + perintah verifikasi `php artisan votes:verify-ledger`, tes bahwa tabel `votes` tidak bisa dikaitkan ke pemilih.
📝 *"Fase 7: `votes`, `VoteService`, ledger hash, tes kerahasiaan & konkurensi. Dilarang menaruh voter_id/timestamp presisi di `votes`."*

### Fase 8 — Live score & halaman publik
✅ `/public/results` ber-cache 5 detik, halaman publik "Hasil Langsung" (batang per kandidat, partisipasi siswa/guru, pembaruan tiap 5 dtk, label "diperbarui HH:MM:SS"), halaman cek resi (hanya "tercatat"), halaman hasil akhir setelah `published`; tampil baik di HP; grafik memenuhi aksesibilitas (label angka, kontras).
📝 *"Fase 8: ResultService + cache, halaman publik React, cek resi. Jangan tampilkan rincian per kelas/jam."*

### Fase 9 — Panel panitia
✅ Kelola kandidat (nomor, foto, visi-misi), jadwal & status pemilihan (draft/buka/tutup/publikasi) dengan konfirmasi ganda, **daftarkan/cabut tablet** (device token), buka-kunci pemilih, log percobaan cadangan, **indikator anomali** (percobaan gagal beruntun, banyak cadangan di satu tablet, liveness gagal), ekspor log CSV, status "x/N sudah memilih".
📝 *"Fase 9: halaman panitia + endpoint, Policy/role, AuditService, tes otorisasi (siswa/guest ditolak)."*

### Fase 10 — Pengerasan & uji beban
✅ Batas laju per rute; header keamanan; tidak ada kebocoran biometrik di respons/log; **mode simulasi** (pemilihan percobaan dengan data palsu yang bisa dihapus bersih); uji beban ±1.700 identifikasi/pemungutan dalam rentang jam puncak (mis. 60/menit) terhadap server staging; tes pemulihan transaksi gagal; pengunggahan ulang idempoten; (opsional) antrean lokal IndexedDB agar suara yang sudah dikonfirmasi tidak hilang bila koneksi putus sesaat.
📝 *"Fase 10: rate limiting, mode simulasi, skrip uji beban, tinjauan keamanan (`/security-review`), perbaiki temuan."*

### Fase 11 — Deploy Hostinger, uji tablet, hari-H
✅ Deploy alur Hostinger: laptop `npm run build` → commit `public/build` → `git push` → server `git pull` + `composer install --no-dev` + `php artisan migrate --force` + `config:cache`; **model diunggah manual** ke `public/models/`; cek checksum; service worker men-cache `/models/` (dan **tidak** men-cache API); Cloudflare di depan domain; cron `schedule:run` aktif; uji penuh di 3 tablet nyata; pelatihan panitia; gladi bersih (mode simulasi) lalu **bersihkan data simulasi**.
📝 *"Fase 11: skrip/CHECKLIST deploy, konfigurasi service worker & cache header, dokumen runbook hari-H."*

---

## 8. Runbook hari-H (ringkas)

**H-7 s.d. H-1:** impor final pemilih → unggah semua foto → pastikan ≥ 98% terdaftar wajah (sisanya jalur cadangan) → gladi bersih simulasi di 3 tablet → hapus data simulasi → set jadwal buka/tutup → cadangkan DB.
**Pagi hari-H:** tablet terisi penuh & dicolok, Chrome terbuka di halaman kiosk, **screen pinning** aktif (Pengaturan → Keamanan → Sematkan aplikasi), kecerahan maks, auto-lock nonaktif, kamera depan diberi izin, posisi tablet menghadap sumber cahaya (bukan membelakangi jendela), latar polos. Sediakan hotspot cadangan & powerbank.
**Selama voting:** satu panitia memantau panel (anomali, tablet aktif, partisipasi); jangan mengubah data pemilih/kandidat setelah buka.
**Penutupan:** tutup pemilihan → jalankan verifikasi ledger → unduh laporan → publikasikan hasil akhir + hash terakhir → cadangkan DB.
**Pasca-pemilihan:** **hapus semua template wajah** (`face_templates`) sesuai kebijakan retensi (mis. ≤ 7 hari setelah hasil final), simpan hasil agregat & ledger saja, dokumentasikan penghapusan.

**Bila internet sekolah putus:** pindah ke hotspot cadangan; suara yang sudah dikonfirmasi tertahan di tablet dan dikirim ulang otomatis (idempotent) bila fitur antrean lokal dibuat (Fase 10). Identifikasi baru tetap butuh koneksi.

---

## 9. Rencana pengujian

- **Otomatis (PHPUnit):** impor pemilih, aturan keputusan wajah (cocok/ambigu/ditolak), cadangan & penguncian, voting atomik & konkurensi, kerahasiaan suara, ledger, otorisasi, jam voting, cache hasil.
- **Akurasi wajah (manual, Fase 3):** 20–30 sukarelawan; kondisi: cahaya terang/redup, kacamata, tanpa/ dengan peci/kerudung, jarak berbeda; catat FAR/FRR; uji 2 siswa mirip; uji **serangan**: foto di HP, foto cetak, video — harus gagal di liveness.
- **Perangkat:** 3 tablet nyata, Chrome versi terkini, orientasi potret & lanskap, 360px untuk HP.
- **Beban:** simulasi 60 pemilih/menit; pantau waktu respons identifikasi & `/public/results` (polling banyak penonton → harus ter-cache).
- **Keamanan:** token perangkat dicabut → tablet langsung ditolak; percobaan cadangan 4× → terkunci; permintaan voting ganda bersamaan → satu sukses; tidak ada NISN/vektor di log atau respons publik.

---

## 10. Privasi, izin, & etika (wajib)

- Data wajah = **data biometrik, kategori data pribadi spesifik** (UU PDP No. 27/2022); sebagian besar pemilih **di bawah 18 tahun** → perlu **persetujuan orang tua/wali** dan dasar hukum/izin sekolah.
- Sediakan **jalur non-wajah** untuk siswa yang menolak/orang tua yang tidak setuju (cadangan NISN + tanggal lahir sudah menjawab ini) **tanpa stigma**.
- Minimalisasi: simpan vektor saja, foto dihapus, template dihapus setelah pemilihan.
- Akses template hanya admin; setiap akses tercatat. Tidak ada ekspor template.
- Draf isi surat persetujuan: tujuan (pemilihan OSIS), data apa (vektor wajah, bukan foto), siapa yang mengakses, berapa lama disimpan, hak menolak (pakai cadangan), kontak panitia.
- Tampilan publik hanya agregat; tidak ada data pribadi.

---

## 11. Risiko utama & mitigasi

| Risiko | Mitigasi |
|---|---|
| Wajah gagal terbaca (cahaya, penampilan) | Panduan di layar, lampu, cadangan, foto pas dengan kualitas baik, uji Fase 3 |
| Salah-kenal orang lain (1:N) | Ambang ketat + margin + konfirmasi nama + cadangan |
| Foto/layar dipakai menipu | Liveness aktif + log kejadian + (opsional) pasif |
| Memilih atas nama teman via cadangan | Batas percobaan, sekali pakai, log, deteksi anomali (diterima pemilik sebagai risiko sisa) |
| Internet putus | Hotspot cadangan, antrean lokal suara terkonfirmasi |
| Shared hosting kewalahan oleh pemirsa live score | Snapshot cache 5 dtk + Cloudflare |
| Serangan/bot | Cloudflare, device token, rate limit |
| Data biometrik bocor | Hanya vektor, tidak di log/API publik, dihapus pasca-pemilihan |
| Kerahasiaan suara bocor lewat korelasi | Tanpa timestamp presisi, UUID acak, tabel terpisah |
| Lisensi model | Izin tertulis; siapkan model alternatif |

---

## 12. Definition of Done (setiap fase)

- `php artisan test` lulus; `npm run build` sukses; tidak ada error konsol browser.
- Uji manual alur utama di desktop **dan** tablet/360px.
- `docs/PROGRESS.md` diperbarui (selesai apa, file penting, masalah tersisa, langkah berikut).
- Commit dengan format `feat: ...` / `fix: ...` / `chore: ...` / `docs: ...`.

---

## 13. Daftar keputusan yang MASIH terbuka (tanyakan ke pemilik sebelum fase terkait)

1. Model pengenalan final & lisensinya (Fase 0/3).
2. Guru tanpa NIP: bila nama+tanggal lahir ganda, kolom pembeda apa yang dipakai (mis. kode guru)?
3. Apakah perlu antrean lokal suara saat internet putus (Fase 10)?
4. Jadwal voting (hari, jam buka/tutup) & jumlah tablet final (disarankan 5–6 agar antrean ±1.700 pemilih tidak terlalu lama; 3 tablet ≈ 567 pemilih/tablet).
5. Kebijakan retensi: berapa hari template wajah disimpan setelah hasil final.
