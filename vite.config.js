import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/main.jsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            // Varian "extern wasm": runtime .mjs/.wasm TIDAK dibundel Vite, tetapi dimuat dari
            // public/wasm/ort/ (ort.env.wasm.wasmPaths) — mencegah duplikat 15 MB di public/build.
            'onnxruntime-web/wasm': fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url)),
        },
    },
    optimizeDeps: {
        // ONNX Runtime memuat .mjs/.wasm-nya sendiri dari /wasm/ort/ (lihat faceEngine.js).
        exclude: ['onnxruntime-web'],
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    query: ['@tanstack/react-query', 'axios', 'zustand'],
                },
            },
        },
    },
});
