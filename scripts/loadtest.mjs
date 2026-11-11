#!/usr/bin/env node
// Uji beban alur meja check-in (identify → confirm) → bilik suara (vote) terhadap server STAGING dengan data SIMULASI.
//
// Persiapan (di server staging):
//   php artisan simulation:create --voters=1700 --export=storage/simulation-vectors.json
//   (daftarkan perangkat meja check-in dan bilik suara di panel → salin token-tokennya)
// Jalankan (dari laptop):
//   node scripts/loadtest.mjs --base=https://staging.contoh.id --vectors=storage/simulation-vectors.json \
//        --tokens=kd_checkin1,kd_checkin2 --booths=kd_bilik1,kd_bilik2,kd_bilik3 --rate=60 --count=300 --viewers=50
// Setelah selesai: php artisan simulation:purge --force
//
// --rate     : pemilih per menit (puncak realistis ±60)
// --count    : jumlah pemilih yang disimulasikan
// --viewers  : jumlah penonton live score yang polling /public/results tiap 5 detik
// --noise    : besar derau pada vektor (meniru variasi kamera), bawaan 0.25
import { readFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const base = (args.base || 'http://127.0.0.1:8000').replace(/\/$/, '');
const tokens = (args.tokens || '').split(',').filter(Boolean); // meja check-in
const boothTokens = (args.booths || '').split(',').filter(Boolean); // bilik suara
const rate = Number(args.rate || 60);
const count = Number(args.count || 100);
const viewers = Number(args.viewers || 0);
const noise = Number(args.noise ?? 0.25);
const MODEL = args.model || 'buffalo_s/w600k_mbf';

if (!tokens.length || !boothTokens.length || !args.vectors) {
    console.error('Wajib: --tokens=kd_checkin --booths=kd_bilik --vectors=path.json');
    process.exit(1);
}
const voters = JSON.parse(readFileSync(args.vectors, 'utf8')).voters.slice(0, count);

const stats = {};
function record(name, ms, ok) {
    (stats[name] ??= { ms: [], ok: 0, fail: 0 }).ms.push(ms);
    ok ? stats[name].ok++ : stats[name].fail++;
}
async function call(name, method, path, token, body) {
    const t0 = performance.now();
    try {
        const res = await fetch(base + path, {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { 'X-Device-Token': token } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        record(name, performance.now() - t0, res.ok);
        return { status: res.status, data };
    } catch (e) {
        record(name, performance.now() - t0, false);
        return { status: 0, data: { message: e.message } };
    }
}

function perturb(vec) {
    // vektor + derau gaussian kecil → dinormalisasi ulang (cos ≈ 1/sqrt(1+noise²))
    const out = vec.map((v) => v + (noise / Math.sqrt(vec.length)) * gauss());
    const n = Math.hypot(...out);
    return out.map((v) => Math.round((v / n) * 1e6) / 1e6);
}
function gauss() {
    const u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const outcome = { voted: 0, failed: 0, reasons: {} };
async function voter(v, i) {
    // Meja check-in: identifikasi wajah → konfirmasi nama (check-in).
    const token = tokens[i % tokens.length];
    const id = await call('identify', 'POST', '/api/v1/kiosk/identify', token, { embedding: perturb(v.embedding), model_version: MODEL, liveness: { passed: true, challenges: ['blink', 'turn'] } });
    if (id.status !== 200) return fail(id);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 700)); // waktu membaca nama
    const cf = await call('confirm', 'POST', '/api/v1/kiosk/confirm', token, { ticket: id.data.ticket, accepted: true });
    if (cf.status !== 200) return fail(cf);

    // Bilik suara: berjalan ke bilik → status → surat suara → pilih.
    const booth = boothTokens[i % boothTokens.length];
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000)); // berjalan ke bilik
    await call('booth_status', 'GET', '/api/v1/kiosk/booth/status', booth);
    const cands = await call('candidates', 'GET', '/api/v1/kiosk/candidates', booth);
    const list = cands.data.data || [];
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500)); // waktu memilih
    const vt = await call('vote', 'POST', '/api/v1/kiosk/vote', booth, {
        candidate_id: list[Math.floor(Math.random() * list.length)]?.id,
        idempotency_key: crypto.randomUUID(),
    });
    if (vt.status !== 201) return fail(vt);
    outcome.voted++;
}
function fail(r) {
    outcome.failed++;
    const k = `${r.status} ${r.data.code || r.data.message || ''}`;
    outcome.reasons[k] = (outcome.reasons[k] || 0) + 1;
}

let stopViewers = false;
async function viewer() {
    while (!stopViewers) {
        await call('public_results', 'GET', '/api/v1/public/results');
        await new Promise((r) => setTimeout(r, 5000));
    }
}

console.log(`Uji beban: ${voters.length} pemilih @ ${rate}/menit, ${tokens.length} meja check-in, ${boothTokens.length} bilik, ${viewers} penonton → ${base}`);
const viewerTasks = Array.from({ length: viewers }, viewer);
const started = performance.now();
const tasks = [];
for (let i = 0; i < voters.length; i++) {
    tasks.push(voter(voters[i], i));
    await new Promise((r) => setTimeout(r, 60000 / rate));
}
await Promise.all(tasks);
stopViewers = true;
await Promise.allSettled(viewerTasks);

const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(0) : '-';
};
console.log(`\nSelesai dalam ${((performance.now() - started) / 1000).toFixed(1)} dtk — berhasil memilih ${outcome.voted}, gagal ${outcome.failed}`);
if (outcome.failed) console.log('Alasan gagal:', outcome.reasons);
console.table(
    Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, { n: s.ms.length, gagal: s.fail, p50_ms: pct(s.ms, 0.5), p95_ms: pct(s.ms, 0.95), maks_ms: pct(s.ms, 1) }])),
);
