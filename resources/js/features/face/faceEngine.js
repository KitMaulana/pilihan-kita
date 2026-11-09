// Mesin wajah di browser: deteksi SCRFD (det_500m) + embedding ArcFace (w600k_mbf) via ONNX Runtime Web.
// Hanya VEKTOR 512-d yang dikirim ke server. Gambar tidak pernah meninggalkan perangkat.
import * as ort from 'onnxruntime-web/wasm';
import { DETECTION, MODELS, MODEL_VERSION, WASM_PATHS } from './config';
import { warpFace } from './align';

ort.env.wasm.wasmPaths = WASM_PATHS.ort;
// Multi-thread butuh cross-origin isolation (COOP+COEP). Tanpa itu, pakai 1 thread.
ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
ort.env.wasm.simd = true;

let detSession = null;
let recSession = null;
let loading = null;
const timings = {};

async function fetchModel(url, onProgress) {
    // Cache bawaan (bukan force-cache): respons 404 lama tidak boleh tersangkut di cache peramban.
    // Cache model untuk kiosk ditangani service worker (public/sw.js), hanya untuk respons 200.
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Model tidak ditemukan: ${url} (HTTP ${res.status}). Lihat public/models/README.md.`);
    }
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total || !onProgress) return new Uint8Array(await res.arrayBuffer());

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received / total);
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.length;
    }
    return out;
}

/** Memuat kedua model sekali (di-cache browser/service worker). onProgress(0..1, label). */
export function loadFaceEngine(onProgress = () => {}) {
    loading ??= (async () => {
        const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
        const t0 = performance.now();
        const det = await fetchModel(MODELS.detector, (p) => onProgress(p * 0.15, 'Memuat detektor wajah'));
        const rec = await fetchModel(MODELS.recognizer, (p) => onProgress(0.15 + p * 0.75, 'Memuat model pengenal'));
        onProgress(0.92, 'Menyiapkan mesin');
        detSession = await ort.InferenceSession.create(det, opts);
        recSession = await ort.InferenceSession.create(rec, opts);
        timings.load = performance.now() - t0;
        onProgress(1, 'Siap');
        return { modelVersion: MODEL_VERSION };
    })().catch((e) => {
        loading = null;
        throw e;
    });
    return loading;
}

export function isFaceEngineReady() {
    return !!(detSession && recSession);
}

export function lastTimings() {
    return { ...timings };
}

function sourceSize(src) {
    return {
        w: src.videoWidth || src.naturalWidth || src.width,
        h: src.videoHeight || src.naturalHeight || src.height,
    };
}

const workCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/**
 * Deteksi wajah. Mengembalikan [{ box:[x1,y1,x2,y2], score, kps:[[x,y]×5] }] terurut skor,
 * dalam koordinat sumber asli.
 */
export async function detectFaces(source, size = DETECTION.kioskSize) {
    if (!detSession) throw new Error('Mesin wajah belum dimuat.');
    const t0 = performance.now();
    const { w, h } = sourceSize(source);
    const scale = Math.min(size / w, size / h);
    const nw = Math.round(w * scale);
    const nh = Math.round(h * scale);

    workCanvas.width = size;
    workCanvas.height = size;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(source, 0, 0, nw, nh); // letterbox kiri-atas seperti InsightFace
    const pixels = ctx.getImageData(0, 0, size, size).data;

    // NCHW, RGB, (x − 127.5) / 128
    const area = size * size;
    const input = new Float32Array(3 * area);
    for (let i = 0, p = 0; p < area; i += 4, p++) {
        input[p] = (pixels[i] - 127.5) / 128;
        input[p + area] = (pixels[i + 1] - 127.5) / 128;
        input[p + 2 * area] = (pixels[i + 2] - 127.5) / 128;
    }

    const feeds = { [detSession.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, size, size]) };
    const out = await detSession.run(feeds);
    const faces = decodeScrfd(detSession.outputNames.map((n) => out[n]), size, scale);
    timings.detect = performance.now() - t0;
    return faces;
}

/**
 * Dekode keluaran SCRFD. Keluaran dikenali dari bentuknya (kolom 1 = skor, 4 = kotak, 10 = titik)
 * dan stride dari jumlah baris (= (size/stride)² × 2 anchor), sehingga tidak bergantung urutan nama.
 */
function decodeScrfd(tensors, size, scale) {
    const groups = {};
    for (const t of tensors) {
        const cols = t.dims[t.dims.length - 1];
        const rows = t.data.length / cols;
        for (const stride of [8, 16, 32]) {
            if (rows === (size / stride) ** 2 * 2) {
                groups[stride] ??= {};
                if (cols === 1) groups[stride].scores = t.data;
                else if (cols === 4) groups[stride].boxes = t.data;
                else if (cols === 10) groups[stride].kps = t.data;
            }
        }
    }

    const cands = [];
    for (const stride of [8, 16, 32]) {
        const g = groups[stride];
        if (!g?.scores || !g.boxes) continue;
        const fw = size / stride;
        const n = g.scores.length;
        for (let i = 0; i < n; i++) {
            const score = g.scores[i];
            if (score < DETECTION.scoreThreshold) continue;
            const cell = i >> 1; // 2 anchor per sel
            const cx = (cell % fw) * stride;
            const cy = Math.floor(cell / fw) * stride;
            const b = i * 4;
            const box = [
                (cx - g.boxes[b] * stride) / scale,
                (cy - g.boxes[b + 1] * stride) / scale,
                (cx + g.boxes[b + 2] * stride) / scale,
                (cy + g.boxes[b + 3] * stride) / scale,
            ];
            const kps = [];
            if (g.kps) {
                for (let k = 0; k < 5; k++) {
                    kps.push([(cx + g.kps[i * 10 + k * 2] * stride) / scale, (cy + g.kps[i * 10 + k * 2 + 1] * stride) / scale]);
                }
            }
            cands.push({ box, score, kps });
        }
    }
    return nms(cands, DETECTION.nmsThreshold);
}

function nms(items, thr) {
    items.sort((a, b) => b.score - a.score);
    const keep = [];
    for (const it of items) {
        if (keep.every((k) => iou(k.box, it.box) <= thr)) keep.push(it);
    }
    return keep;
}

function iou(a, b) {
    const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return ua > 0 ? inter / ua : 0;
}

/** Embedding 512-d ternormalisasi L2 dari wajah (butuh 5 titik kps). Mengembalikan {embedding, aligned}. */
export async function embedFace(source, face, alignedCanvas = null) {
    if (!recSession) throw new Error('Mesin wajah belum dimuat.');
    if (!face.kps || face.kps.length !== 5) throw new Error('Titik wajah tidak lengkap.');
    const t0 = performance.now();
    const aligned = warpFace(source, face.kps, 112, alignedCanvas);
    const px = aligned.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 112, 112).data;

    // NCHW, RGB, (x − 127.5) / 127.5
    const area = 112 * 112;
    const input = new Float32Array(3 * area);
    for (let i = 0, p = 0; p < area; i += 4, p++) {
        input[p] = (px[i] - 127.5) / 127.5;
        input[p + area] = (px[i + 1] - 127.5) / 127.5;
        input[p + 2 * area] = (px[i + 2] - 127.5) / 127.5;
    }
    const out = await recSession.run({ [recSession.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 112, 112]) });
    const raw = out[recSession.outputNames[0]].data;

    let norm = 0;
    for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
    norm = Math.sqrt(norm) || 1;
    const embedding = Array.from(raw, (v) => Math.round((v / norm) * 1e6) / 1e6);

    timings.embed = performance.now() - t0;
    return { embedding, aligned };
}

export function cosine(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}

/** Memuat File gambar menjadi ImageBitmap/HTMLImageElement (memperhatikan orientasi EXIF). */
export async function loadImageFile(file) {
    if ('createImageBitmap' in window) {
        try {
            return await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
            /* lanjut ke cara lama */
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}
