// Liveness AKTIF dengan MediaPipe Face Landmarker: pemilih diminta berkedip dan menolehkan kepala.
// Tantangan diacak urutannya. Foto cetak/foto di layar tidak bisa berkedip & menoleh secara alami.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { LIVENESS, MODELS, WASM_PATHS } from './config';

let landmarker = null;
let loading = null;

export function loadLiveness() {
    loading ??= (async () => {
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATHS.mediapipe);
        const make = (delegate) =>
            FaceLandmarker.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: MODELS.landmarker, delegate },
                runningMode: 'VIDEO',
                numFaces: 2,
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: false,
            });
        try {
            landmarker = await make('GPU');
        } catch {
            landmarker = await make('CPU'); // sebagian tablet tidak mendukung WebGL2 delegate
        }
        return landmarker;
    })().catch((e) => {
        loading = null;
        throw e;
    });
    return loading;
}

let lastTs = 0;

/**
 * Analisis satu frame video.
 * @returns {{faces:number, blink:number, yaw:number, size:number, center:{x:number,y:number}}|null}
 *   blink = rata-rata skor mata tertutup (0..1), yaw = rasio posisi hidung (≈0.5 menghadap depan),
 *   size = lebar wajah relatif terhadap frame.
 */
export function analyzeFrame(video) {
    if (!landmarker || video.readyState < 2) return null;
    let ts = performance.now();
    if (ts <= lastTs) ts = lastTs + 1;
    lastTs = ts;

    const res = landmarker.detectForVideo(video, ts);
    const faces = res.faceLandmarks?.length || 0;
    if (!faces) return { faces: 0 };

    const lm = res.faceLandmarks[0];
    const shapes = res.faceBlendshapes?.[0]?.categories || [];
    const score = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0;

    const left = lm[234], right = lm[454], nose = lm[1];
    const span = right.x - left.x;
    const yaw = Math.abs(span) > 1e-6 ? (nose.x - left.x) / span : 0.5;

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of lm) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    return {
        faces,
        blink: (score('eyeBlinkLeft') + score('eyeBlinkRight')) / 2,
        yaw,
        size: maxX - minX,
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    };
}

export const CHALLENGE_TEXT = {
    blink: 'Kedipkan mata Anda',
    turn: 'Tolehkan kepala perlahan ke kiri atau ke kanan',
    front: 'Kembali menghadap kamera',
};

/** Urutan tantangan acak: [kedip, toleh] atau [toleh, kedip], lalu kembali menghadap depan. */
export function randomChallenges() {
    const order = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? ['blink', 'turn'] : ['turn', 'blink'];
    return [...order, 'front'];
}

/**
 * Mesin status liveness. Panggil `step(frame)` tiap frame; mengembalikan
 * { done, passed, current, index, total, message }.
 */
export function createLivenessSession(challenges = randomChallenges()) {
    const startedAt = performance.now();
    let index = 0;
    let eyesWereOpen = false;
    let eyesClosed = false;
    let multiFaceFrames = 0;

    return {
        challenges,
        step(frame) {
            const elapsed = performance.now() - startedAt;
            const current = challenges[index];
            const base = { index, total: challenges.length, current, elapsed };

            if (elapsed > LIVENESS.timeoutMs) {
                return { ...base, done: true, passed: false, message: 'Waktu habis' };
            }
            if (!frame || frame.faces === 0) return { ...base, done: false, message: 'Wajah tidak terlihat' };
            if (frame.faces > 1) {
                multiFaceFrames++;
                if (multiFaceFrames > 15) return { ...base, done: true, passed: false, message: 'Lebih dari satu wajah' };
                return { ...base, done: false, message: 'Hanya satu orang di depan kamera' };
            }

            let ok = false;
            if (current === 'blink') {
                if (frame.blink < LIVENESS.blinkOpen) {
                    if (eyesClosed) ok = true; // terbuka → tertutup → terbuka
                    eyesWereOpen = true;
                } else if (frame.blink > LIVENESS.blinkClosed && eyesWereOpen) {
                    eyesClosed = true;
                }
            } else if (current === 'turn') {
                ok = Math.abs(frame.yaw - 0.5) >= LIVENESS.turnRatio;
            } else if (current === 'front') {
                ok = Math.abs(frame.yaw - 0.5) <= LIVENESS.frontalRatio && frame.blink < LIVENESS.blinkOpen;
            }

            if (ok) {
                index++;
                eyesWereOpen = false;
                eyesClosed = false;
                if (index >= challenges.length) {
                    return { ...base, index, done: true, passed: true, message: 'Berhasil' };
                }
            }
            return { ...base, index, current: challenges[index], done: false, message: CHALLENGE_TEXT[challenges[index]] };
        },
    };
}
