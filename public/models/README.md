# Model wajah

Ketiga model **ikut di-commit** (keputusan pemilik 2026-11-10) sehingga `git pull` di server sudah membawanya.
Baca **[NOTICE.md](NOTICE.md)** untuk lisensi (InsightFace: hanya non-komersial). Bagian "Langkah" di bawah hanya
perlu bila berkas hilang/rusak atau model diganti.

| Berkas | Sumber resmi | Perkiraan ukuran | Fungsi |
|---|---|---|---|
| `det_500m.onnx` | InsightFace `buffalo_s.zip` — https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_s.zip | ±2,5 MB | Detektor wajah SCRFD-500M |
| `w600k_mbf.onnx` | sama (`buffalo_s.zip`) | ±13 MB | Pengenal wajah MobileFaceNet (ArcFace, 512-d) |
| `face_landmarker.task` | Google MediaPipe — https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task | 3.758.596 byte | Landmark & blendshape untuk liveness |

## Langkah

1. Unduh `buffalo_s.zip` dari tautan resmi di atas, ekstrak, ambil **hanya** `det_500m.onnx` dan `w600k_mbf.onnx`
   (berkas lain — `1k3d68.onnx`, `2d106det.onnx`, `genderage.onnx` — tidak dipakai).
2. Unduh `face_landmarker.task`.
3. Salin ketiganya ke `public/models/` (lokal) dan ke `public_html/.../public/models/` di Hostinger (via File Manager/SFTP).
4. Catat checksum SHA-256 dan bandingkan lokal vs server:
   ```powershell
   Get-FileHash -Algorithm SHA256 public\models\*
   ```
   ```bash
   sha256sum public/models/*
   ```

## Checksum terverifikasi

| Berkas | SHA-256 |
|---|---|
| `face_landmarker.task` | `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF` (diunduh 2026-11-09) |
| `det_500m.onnx` | `5E4447F50245BBD7966BD6C0FA52938C61474A04EC7DEF48753668A9D8B4EA3A` (2.524.817 byte, 2026-11-09) |
| `w600k_mbf.onnx` | `9CC6E4A75F0E2BF0B1AED94578F144D15175F357BDC05E815E5C4A02B319EB4F` (13.616.099 byte, 2026-11-09) |


## Lisensi (WAJIB dibaca)

- Model pra-latih InsightFace berlisensi **non-komersial / riset**. Pemilihan OSIS bersifat non-komersial, tetapi
  **minta persetujuan tertulis kepala sekolah** dan cantumkan sumber model di dokumentasi panitia (lihat docs/PRIVASI-DAN-IZIN.md).
- MediaPipe Face Landmarker: Apache 2.0.

## Mengganti model

Bila model diganti (mis. alternatif berlisensi lebih longgar), ubah:
- `MODEL_VERSION` di `resources/js/features/face/config.js`, dan
- `FACE_MODEL_VERSION` di `.env` server,

lalu **daftarkan ulang semua pas foto** (vektor model berbeda tidak bisa dibandingkan) dan naikkan `VERSION` di `public/sw.js`.
