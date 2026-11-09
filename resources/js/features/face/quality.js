import { QUALITY } from './config';

/** Kecerahan rata-rata & ketajaman (varians Laplacian) dari canvas wajah ter-jajar. */
export function measureQuality(faceCanvas) {
    const { width: w, height: h } = faceCanvas;
    const data = faceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[p] = g;
        sum += g;
    }
    const brightness = sum / (w * h);

    // Laplacian 4-tetangga pada area tengah (hindari tepi hitam hasil warp).
    let lsum = 0, lsq = 0, count = 0;
    const m = Math.floor(w * 0.15);
    for (let y = m; y < h - m; y++) {
        for (let x = m; x < w - m; x++) {
            const i = y * w + x;
            const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
            lsum += lap;
            lsq += lap * lap;
            count++;
        }
    }
    const mean = lsum / count;
    const sharpness = lsq / count - mean * mean;

    return { brightness, sharpness };
}

/**
 * Menilai kelayakan pas foto. Mengembalikan { ok, reasons[], score (0..1) }.
 * `faces` = hasil deteksi pada foto asli; `face` = wajah terpilih; `metrics` dari measureQuality.
 */
export function assessEnrollment(faces, metrics) {
    const reasons = [];
    if (faces.length === 0) return { ok: false, reasons: ['Tidak ada wajah terdeteksi'], score: 0 };
    if (faces.length > 1) reasons.push(`Terdeteksi ${faces.length} wajah (harus tepat 1)`);

    const face = faces[0];
    const width = face.box[2] - face.box[0];
    if (face.score < QUALITY.minDetScore) reasons.push('Wajah kurang jelas terdeteksi');
    if (width < QUALITY.minFaceSizeEnroll) reasons.push(`Wajah terlalu kecil (${Math.round(width)} px, min. ${QUALITY.minFaceSizeEnroll} px)`);
    if (metrics.sharpness < QUALITY.minSharpness) reasons.push('Foto buram');
    if (metrics.brightness < QUALITY.minBrightness) reasons.push('Foto terlalu gelap');
    if (metrics.brightness > QUALITY.maxBrightness) reasons.push('Foto terlalu terang');

    const score =
        0.4 * Math.min(1, face.score) +
        0.3 * Math.min(1, metrics.sharpness / (QUALITY.minSharpness * 4)) +
        0.3 * (1 - Math.min(1, Math.abs(metrics.brightness - 130) / 130));

    return { ok: reasons.length === 0, reasons, score: Math.round(score * 1000) / 1000 };
}
