# Model wajah — unggah MANUAL (tidak masuk Git)

Folder ini di-`.gitignore`. Model tidak di-commit karena ukuran dan **lisensi**.

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
| `det_500m.onnx` | _isi saat mengunduh_ |
| `w600k_mbf.onnx` | _isi saat mengunduh_ |

> Isi baris yang kosong ketika model pertama kali diunduh, lalu gunakan sebagai acuan di server.

## Lisensi (WAJIB dibaca)

- Model pra-latih InsightFace berlisensi **non-komersial / riset**. Pemilihan OSIS bersifat non-komersial, tetapi
  **minta persetujuan tertulis kepala sekolah** dan cantumkan sumber model di dokumentasi panitia (lihat docs/PRIVASI-DAN-IZIN.md).
- MediaPipe Face Landmarker: Apache 2.0.

## Mengganti model

Bila model diganti (mis. alternatif berlisensi lebih longgar), ubah:
- `MODEL_VERSION` di `resources/js/features/face/config.js`, dan
- `FACE_MODEL_VERSION` di `.env` server,

lalu **daftarkan ulang semua pas foto** (vektor model berbeda tidak bisa dibandingkan) dan naikkan `VERSION` di `public/sw.js`.
