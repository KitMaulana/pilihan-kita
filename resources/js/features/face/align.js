// Penjajaran wajah ArcFace: transformasi similaritas (rotasi + skala seragam + translasi)
// dari 5 titik wajah (mata kiri, mata kanan, hidung, mulut kiri, mulut kanan) ke templat 112x112.

export const ARCFACE_TEMPLATE = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
];

/**
 * Estimasi kuadrat-terkecil transformasi similaritas src → dst (setara skimage SimilarityTransform).
 * Mengembalikan {a, b, tx, ty} dengan  x' = a·x − b·y + tx,  y' = b·x + a·y + ty.
 */
export function estimateSimilarity(src, dst = ARCFACE_TEMPLATE) {
    const n = src.length;
    let sx = 0, sy = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        sx += src[i][0]; sy += src[i][1];
        dx += dst[i][0]; dy += dst[i][1];
    }
    sx /= n; sy /= n; dx /= n; dy /= n;

    let num1 = 0, num2 = 0, den = 0;
    for (let i = 0; i < n; i++) {
        const px = src[i][0] - sx, py = src[i][1] - sy;
        const qx = dst[i][0] - dx, qy = dst[i][1] - dy;
        num1 += px * qx + py * qy;
        num2 += px * qy - py * qx;
        den += px * px + py * py;
    }
    const a = den ? num1 / den : 1;
    const b = den ? num2 / den : 0;

    return { a, b, tx: dx - (a * sx - b * sy), ty: dy - (b * sx + a * sy) };
}

/** Gambar wajah ter-jajar 112x112 ke canvas dari sumber (video/gambar/canvas). */
export function warpFace(source, kps, size = 112, canvas = null) {
    const c = canvas || document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const { a, b, tx, ty } = estimateSimilarity(kps);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    // setTransform(a, b, c, d, e, f): x' = a·x + c·y + e ; y' = b·x + d·y + f
    ctx.setTransform(a, b, -b, a, tx, ty);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
}
