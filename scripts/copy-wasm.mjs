// Menyalin runtime WASM (ONNX Runtime Web & MediaPipe) dari node_modules ke public/wasm/
// agar dilayani dari origin sendiri (tanpa CDN) dan bisa di-cache service worker.
// Dijalankan otomatis oleh `npm run dev` dan `npm run build`.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
    ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/wasm/ort/ort-wasm-simd-threaded.mjs'],
    ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/wasm/ort/ort-wasm-simd-threaded.wasm'],
    ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', 'public/wasm/mediapipe/vision_wasm_internal.js'],
    ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', 'public/wasm/mediapipe/vision_wasm_internal.wasm'],
];

for (const [from, to] of files) {
    const src = join(root, from);
    const dst = join(root, to);
    if (!existsSync(src)) {
        console.error(`[copy-wasm] Tidak ditemukan: ${from} — jalankan "npm install".`);
        process.exit(1);
    }
    if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    console.log(`[copy-wasm] ${to}`);
}
