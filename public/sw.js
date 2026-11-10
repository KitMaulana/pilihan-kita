/*
 * Service worker kiosk.
 *  - Model wajah (/models/) & runtime WASM (/wasm/) : cache-first (berkas besar, jarang berubah).
 *  - Aset build (/build/)                            : cache-first (nama berkas ber-hash).
 *  - API (/api/, /sanctum/)                         : TIDAK PERNAH di-cache.
 *  - Halaman (navigasi)                             : network-first, fallback ke cache.
 * Naikkan VERSION bila model diganti agar cache lama dibuang.
 */
const VERSION = 'v2'; // v2: buang salinan .mjs bertipe salah (text/plain) yang sempat ter-cache
const STATIC_CACHE = `pk-static-${VERSION}`;
const PAGE_CACHE = `pk-pages-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('pk-') && ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))),
        ).then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sanctum/')) return; // jangan cache API

    if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/wasm/') || url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const needsJs = /\.m?js$/.test(url.pathname);
                const isJs = (r) => /javascript/i.test(r.headers.get('content-type') || '');
                const hit = await cache.match(req, { ignoreSearch: true });
                if (hit && (!needsJs || isJs(hit))) return hit;
                const res = await fetch(req);
                // Modul JS bertipe salah tidak disimpan (peramban menolak import() modul bukan-JavaScript).
                if (res.ok && res.status === 200 && (!needsJs || isJs(res))) cache.put(req, res.clone());
                return res;
            }),
        );
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('/kiosk'))),
        );
    }
});
