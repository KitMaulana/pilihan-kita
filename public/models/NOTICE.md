# Pemberitahuan lisensi model wajah

Berkas model di folder ini **disertakan dalam repositori atas keputusan pemilik proyek (2026-11-10)** agar pemasangan
cukup dengan `git pull`. Model BUKAN karya proyek ini dan tunduk pada lisensi pemilik aslinya.

| Berkas | Sumber | Lisensi / batasan |
|---|---|---|
| `det_500m.onnx` (SCRFD-500M) | InsightFace — paket `buffalo_s` (https://github.com/deepinsight/insightface) | **Hanya untuk riset non-komersial.** Lihat lisensi & README model InsightFace. |
| `w600k_mbf.onnx` (MobileFaceNet ArcFace, dilatih pada WebFace600K) | InsightFace — paket `buffalo_s` | **Hanya untuk riset non-komersial.** Data latih berlisensi non-komersial. |
| `face_landmarker.task` | Google MediaPipe (https://ai.google.dev/edge/mediapipe) | Apache License 2.0 |

## Yang perlu diperhatikan siapa pun yang memakai repositori ini

- **Penggunaan komersial dilarang** untuk dua model InsightFace. Proyek ini dibuat untuk pemilihan OSIS (non-komersial).
  Bila hendak dipakai di luar itu, ganti model dengan alternatif berlisensi longgar (lihat bagian "Mengganti model" di README folder ini).
- Pemilik proyek diminta memperoleh **persetujuan tertulis kepala sekolah** atas penggunaan model (CLAUDE.md §3).
- Repositori ini publik: menyertakan model berarti mendistribusikannya ulang. Bila pemilik hak model keberatan, berkas
  akan dihapus dari repositori.

Checksum SHA-256 tercantum di `README.md` folder ini. Bandingkan setelah `git pull` di server.
