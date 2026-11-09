// Konfigurasi mesin wajah. Nama berkas harus sama dengan yang diunggah ke public/models/
// (lihat public/models/README.md). MODEL_VERSION harus sama dengan FACE_MODEL_VERSION di .env server.
export const MODEL_VERSION = 'buffalo_s/w600k_mbf';

export const MODELS = {
    detector: '/models/det_500m.onnx', // SCRFD-500M (InsightFace buffalo_s)
    recognizer: '/models/w600k_mbf.onnx', // MobileFaceNet ArcFace, keluaran 512-d
    landmarker: '/models/face_landmarker.task', // MediaPipe Face Landmarker (liveness)
};

export const WASM_PATHS = {
    ort: '/wasm/ort/',
    mediapipe: '/wasm/mediapipe',
};

export const DETECTION = {
    kioskSize: 320, // input detektor di kiosk (wajah dekat kamera) — lebih cepat
    enrollSize: 640, // input detektor untuk pas foto
    scoreThreshold: 0.5,
    nmsThreshold: 0.4,
};

// Ambang kualitas (dikalibrasi ulang di Fase 3 bila perlu).
export const QUALITY = {
    minDetScore: 0.6,
    minFaceSizeEnroll: 80, // px lebar kotak wajah pada foto asli
    minFaceRatioKiosk: 0.18, // lebar wajah / lebar frame kamera
    minSharpness: 25, // varians Laplacian pada wajah 112x112 (grayscale)
    minBrightness: 55,
    maxBrightness: 215,
};

export const LIVENESS = {
    timeoutMs: 12000,
    blinkClosed: 0.5, // skor blendshape mata tertutup
    blinkOpen: 0.3,
    turnRatio: 0.18, // simpangan rasio hidung dari tengah (0.5 ± ini) dianggap menoleh
    frontalRatio: 0.08, // |rasio - 0.5| <= ini dianggap menghadap depan
};
