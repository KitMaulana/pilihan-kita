# Privasi, Izin, dan Draf Surat Persetujuan

Data wajah adalah **data biometrik — data pribadi yang bersifat spesifik** (UU No. 27/2022 tentang Pelindungan Data Pribadi).
Sebagian besar pemilih di bawah 18 tahun → **wajib persetujuan orang tua/wali** dan izin kepala sekolah.

## Cara sistem melindungi data

| Prinsip | Implementasi |
|---|---|
| Minimalisasi | Foto pas diproses **di peramban panitia** menjadi vektor 512 angka; foto **tidak pernah diunggah** ke server. Tablet juga hanya mengirim vektor. |
| Tidak ada foto di layar | Layar konfirmasi hanya menampilkan nama + kelas. |
| Template tidak keluar server | Pencocokan 1:N di server; template tidak pernah dikirim ke tablet maupun ditampilkan di API. Tidak ada fitur ekspor template. |
| Kerahasiaan suara | Tabel suara tanpa identitas & tanpa waktu; penanda "sudah memilih" terpisah; urutan ledger diacak per kelompok. |
| Jejak akses | Setiap unggah/hapus template & aksi panitia tercatat di log aktivitas. |
| Retensi | Semua template dihapus setelah hasil final (tombol "Hapus semua template wajah"). |
| Hak menolak | Jalur NISN/NIP + tanggal lahir tersedia di tablet yang sama, tanpa perlu menjelaskan alasan. |

## Model & lisensi

Model pengenal wajah InsightFace (`buffalo_s`: `det_500m`, `w600k_mbf`) berlisensi **non-komersial/riset**.
Kegiatan ini non-komersial, tetapi tetap diperlukan **persetujuan tertulis kepala sekolah** atas penggunaannya.
Sumber: https://github.com/deepinsight/insightface. MediaPipe Face Landmarker (Google) berlisensi Apache 2.0.

---

## Draf Surat Persetujuan Orang Tua/Wali

> Sesuaikan kop, tanggal, dan kontak sebelum dibagikan.

**SMA NEGERI 1 CIRUAS**
Perihal: Permohonan Persetujuan Penggunaan Data Wajah untuk Pemilihan Ketua OSIS

Yth. Bapak/Ibu Orang Tua/Wali Siswa,

Dalam rangka Pemilihan Ketua OSIS tahun pelajaran ......../........, sekolah menggunakan sistem pemungutan suara elektronik
"One Face One Vote" yang mengenali pemilih melalui wajah agar setiap siswa hanya dapat memilih satu kali.

1. **Tujuan:** memastikan satu siswa satu suara pada Pemilihan Ketua OSIS. Data tidak digunakan untuk keperluan lain.
2. **Data yang diproses:** pas foto siswa diubah menjadi deretan angka (vektor wajah). **Foto tidak disimpan**; yang disimpan hanya vektor tersebut, beserta nama, kelas, NISN, dan tanggal lahir dari data sekolah.
3. **Siapa yang dapat mengakses:** hanya admin panitia pemilihan yang ditunjuk sekolah; setiap akses tercatat.
4. **Lama penyimpanan:** vektor wajah **dihapus paling lambat ...... hari** setelah hasil pemilihan ditetapkan.
5. **Kerahasiaan pilihan:** sistem tidak menyimpan siapa memilih siapa.
6. **Hak menolak:** Bapak/Ibu boleh tidak menyetujui. Putra/putri Bapak/Ibu tetap dapat memilih dengan NISN dan tanggal lahir tanpa konsekuensi apa pun.
7. **Kontak panitia:** ................................ (nama), ................................ (telepon/WA).

Mohon mengisi dan mengembalikan bagian di bawah ini melalui wali kelas paling lambat ................

Hormat kami,
Ketua Panitia ............................                Kepala SMAN 1 Ciruas ............................

- - - - - - - - - - - - - - - - - - - - - - - - (potong di sini) - - - - - - - - - - - - - - - - - - - - - - - -

Saya yang bertanda tangan di bawah ini, orang tua/wali dari:
Nama siswa: ............................................  Kelas: ..............  NISN: ..........................

☐ **SETUJU** data wajah anak saya digunakan sesuai ketentuan di atas.
☐ **TIDAK SETUJU** — anak saya akan memilih menggunakan NISN dan tanggal lahir.

.................., ....................  Tanda tangan & nama jelas: ........................................

---

## Catatan untuk panitia

- Siswa yang orang tuanya **tidak setuju**: jangan unggah pas fotonya. Ia otomatis memakai jalur cadangan.
- Bila persetujuan ditarik setelah foto diunggah: **Pemilih → Ubah → Hapus wajah** (admin).
- Simpan lembar persetujuan fisik hingga masa retensi berakhir.
