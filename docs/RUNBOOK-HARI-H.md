# Runbook Hari-H

## H-7 s.d. H-1
- [ ] Impor final pemilih (menu **Pemilih → Impor CSV**); semua baris bermasalah diselesaikan.
- [ ] Unggah semua pas foto (**Unggah Foto**); target **≥ 98 % terdaftar wajah** (sisanya jalur cadangan).
- [ ] Periksa filter **"Wajah ganda ditandai"** — pastikan bukan salah unggah foto.
- [ ] Kandidat lengkap (nomor, nama, kelas, foto, visi-misi) — **terkunci setelah dibuka**.
- [ ] Ambang & margin dari Fase 3 sudah disimpan (**Jadwal & Status → Aturan pengenalan wajah**).
- [ ] Daftarkan tablet (**Perangkat**), buka tautan pemasangan di tiap tablet; tablet lama/tak dipakai → **Cabut**.
- [ ] Gladi bersih: **Jadwal → Buat simulasi** → uji di semua tablet (wajah relawan + cadangan NISN 99xxxxxxxx / 2008-01-01) → cek **Hasil Langsung** & **Log**.
- [ ] **Hapus semua data simulasi** (ketik `HAPUS SIMULASI`). Pastikan header panel tidak lagi menampilkan "SIMULASI".
- [ ] Atur jam buka & tutup (WIB). Status tetap **Draf** sampai pagi hari-H.
- [ ] Cadangkan database.

## Pagi hari-H
- [ ] Tablet terisi penuh & dicolok; Chrome terbuka di `/kiosk`; tekan ⛶ (layar penuh).
- [ ] **Screen pinning** aktif (Pengaturan → Keamanan → Sematkan aplikasi).
- [ ] Kecerahan maksimum, auto-lock nonaktif, izin kamera diberikan.
- [ ] Tablet **menghadap sumber cahaya**, tidak membelakangi jendela; latar polos; lampu tambahan bila redup.
- [ ] Hotspot cadangan & powerbank siap.
- [ ] **Jadwal & Status → Buka pemilihan** (ketik `BUKA`). Tablet otomatis berpindah ke layar pemindaian.
- [ ] Panitia mencoblos uji? **Jangan** — semua suara di pemilihan nyata dihitung.

## Selama voting
- Satu panitia memantau **Dasbor** (refresh 10 dtk): anomali, tablet aktif, partisipasi.
- Pemilih terkunci → periksa identitas langsung (kartu pelajar) → **Pemilih → Buka kunci**.
- Pemilih "Bukan saya" pada konfirmasi → arahkan ke jalur NISN/NIP; bila sering terjadi, pertimbangkan menaikkan ambang (admin).
- **Jangan mengubah data pemilih/kandidat** setelah dibuka.
- Tablet hilang/dicurigai → **Perangkat → Cabut** (langsung ditolak server).

## Bila internet sekolah putus
1. Pindahkan tablet ke hotspot cadangan.
2. Suara yang sudah dikonfirmasi dikirim ulang otomatis (idempoten) selama token belum kedaluwarsa (bawaan 3 menit).
3. Identifikasi baru butuh koneksi. Bila mesin wajah gagal dimuat, tekan **"Lanjut tanpa wajah (hanya NISN/NIP)"**.

## Penutupan
- [ ] **Jadwal & Status → Tutup pemilihan** (ketik `TUTUP`) — atau otomatis saat jam tutup (cron).
- [ ] **Verifikasi ledger** → harus VALID; jumlah suara = jumlah penanda sudah memilih.
- [ ] **Cetak laporan** → tanda tangan ketua panitia & kepala sekolah.
- [ ] **Publikasikan hasil akhir** (ketik `PUBLIKASI`) → hash terakhir tampil di `/hasil`.
- [ ] Cadangkan database.

## Pasca-pemilihan (≤ 7 hari setelah hasil final, sesuai kebijakan retensi)
- [ ] **Jadwal & Status → Hapus semua template wajah** (ketik `HAPUS SEMUA WAJAH`), atau `php artisan face:purge-all`.
- [ ] Dokumentasikan penghapusan (tanggal, petugas) — tercatat otomatis di **Log → Aktivitas panitia**.
- [ ] Simpan hanya hasil agregat, ledger, dan laporan.

## Perintah darurat (SSH)
```bash
php artisan votes:verify-ledger        # cek integritas
php artisan votes:seal --force         # segel sisa suara
php artisan election:auto-close        # paksa cek jam tutup
php artisan panitia:create-admin email@sekolah.sch.id   # reset akses admin
```
