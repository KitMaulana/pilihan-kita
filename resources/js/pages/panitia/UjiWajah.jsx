import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { useCamera } from '../../features/face/useCamera';
import { detectFaces, embedFace, lastTimings, loadFaceEngine, loadImageFile } from '../../features/face/faceEngine';
import { analyzeFrame, createLivenessSession, loadLiveness } from '../../features/face/liveness';
import { measureQuality } from '../../features/face/quality';
import { DETECTION } from '../../features/face/config';
import { IconCamera, IconFaceScan } from '../../components/Icons';
import { Alert, Badge, Field, toast } from '../../components/ui';
import { useElection } from './PanitiaLayout';
import UjiWajahCepat from './UjiWajahCepat';

const pct = (v) => `${(v * 100).toFixed(2)}%`;

function Histogram({ genuine, impostor }) {
    const g = histogram(genuine);
    const im = histogram(impostor);
    const gMax = Math.max(1, ...g.map((b) => b.count));
    const iMax = Math.max(1, ...im.map((b) => b.count));
    const W = 600, H = 180, bw = W / g.length;
    return (
        <figure className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="Histogram skor kemiripan: genuine (orang sama) dan impostor (orang berbeda)">
                {im.map((b, i) => {
                    const h = (b.count / iMax) * H;
                    return <rect key={`i${i}`} x={i * bw + 1} y={H - h} width={bw / 2 - 1} height={h} rx="2" className="fill-crimson-500" />;
                })}
                {g.map((b, i) => {
                    const h = (b.count / gMax) * H;
                    return <rect key={`g${i}`} x={i * bw + bw / 2} y={H - h} width={bw / 2 - 1} height={h} rx="2" className="fill-emerald-600" />;
                })}
                {g.map((b, i) =>
                    i % 4 === 0 ? (
                        <text key={`t${i}`} x={i * bw} y={H + 16} className="fill-slate-500 text-[11px]">
                            {b.from.toFixed(1)}
                        </text>
                    ) : null,
                )}
            </svg>
            <figcaption className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-xs bg-emerald-600" /> Genuine / orang sama ({genuine.length} pasang, dinormalisasi)
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-xs bg-crimson-500" /> Impostor / orang berbeda ({impostor.length} pasang, dinormalisasi)
                </span>
            </figcaption>
        </figure>
    );
}

/** Tab lanjutan: diagnostik kamera, pengumpulan sampel sukarelawan, laporan FAR/FRR (gerbang Fase 3). */
function AdvancedTest({ engine, samples, setSamples }) {
    const qc = useQueryClient();
    const [cameraOn, setCameraOn] = useState(false);
    const { videoRef, status: camStatus, error: camError, start, stop } = useCamera({ autoStart: false });
    const [live, setLive] = useState(null);
    const [liveness, setLiveness] = useState(null);
    const [label, setLabel] = useState('');
    const [condition, setCondition] = useState('normal');
    const [population, setPopulation] = useState(1800);
    const [threshold, setThreshold] = useState(0.5);
    const [margin, setMargin] = useState(0.08);
    const sessionRef = useRef(null);
    const benchRef = useRef([]);

    // Loop pratinjau: landmark (liveness) tiap frame, deteksi+embedding tiap ~700 ms.
    useEffect(() => {
        if (camStatus !== 'ready' || engine.state !== 'ready') return;
        let raf = 0, alive = true, lastEmbed = 0, busy = false;
        const loop = async () => {
            if (!alive) return;
            const v = videoRef.current;
            const t0 = performance.now();
            const frame = analyzeFrame(v);
            const tLm = performance.now() - t0;
            if (sessionRef.current) {
                const r = sessionRef.current.step(frame);
                setLiveness(r);
                if (r.done) sessionRef.current = null;
            }
            if (!busy && performance.now() - lastEmbed > 700) {
                busy = true;
                lastEmbed = performance.now();
                try {
                    const faces = await detectFaces(v, DETECTION.kioskSize);
                    let info = { faces: faces.length, landmarkMs: tLm, frame };
                    if (faces.length) {
                        const { embedding, aligned } = await embedFace(v, faces[0]);
                        const q = measureQuality(aligned);
                        const t = lastTimings();
                        info = { ...info, embedding, score: faces[0].score, quality: q, detectMs: t.detect, embedMs: t.embed, width: faces[0].box[2] - faces[0].box[0] };
                        benchRef.current = [...benchRef.current.slice(-49), { d: t.detect, e: t.embed, l: tLm }];
                    }
                    setLive(info);
                } catch (e) {
                    setLive({ error: e.message });
                }
                busy = false;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
        };
    }, [camStatus, engine.state, videoRef]);

    function addLiveSample() {
        if (!live?.embedding) return toast.error('Tidak ada wajah terdeteksi.');
        if (!label.trim()) return toast.error('Isi kode sukarelawan dulu.');
        setSamples((s) => [...s, { label: label.trim(), condition, embedding: live.embedding, source: 'kamera' }]);
        toast.success(`Sampel ditambahkan untuk ${label.trim()}.`);
    }

    async function addFiles(files) {
        // Nama berkas: <kode>_<apa saja>.jpg → label = <kode>
        let added = 0, failed = 0;
        for (const f of files) {
            try {
                const bmp = await loadImageFile(f);
                const faces = await detectFaces(bmp, DETECTION.enrollSize);
                if (faces.length !== 1) {
                    failed++;
                    continue;
                }
                const { embedding } = await embedFace(bmp, faces[0]);
                bmp.close?.();
                const lbl = f.name.replace(/\.[^.]+$/, '').split(/[_\s-]/)[0];
                setSamples((s) => [...s, { label: lbl, condition: 'foto', embedding, source: f.name }]);
                added++;
            } catch {
                failed++;
            }
        }
        toast.info(`${added} sampel dari foto ditambahkan, ${failed} gagal (harus tepat 1 wajah).`);
    }

    function exportJson() {
        const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), samples })], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `akurasi-wajah-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function importJson(file) {
        try {
            const data = JSON.parse(await file.text());
            setSamples((s) => [...s, ...data.samples.filter((x) => Array.isArray(x.embedding) && x.embedding.length === 512)]);
        } catch {
            toast.error('Berkas JSON tidak valid.');
        }
    }

    const analysis = useMemo(() => {
        if (samples.length < 2) return null;
        const { genuine, impostor } = pairScores(samples);
        return { genuine, impostor, rec: recommend(samples, population) };
    }, [samples, population]);

    const sim = useMemo(() => (samples.length > 2 ? simulateIdentification(samples, threshold, margin) : null), [samples, threshold, margin]);

    async function applySettings() {
        try {
            await api.put('/panitia/election', { settings: { match_threshold: threshold, match_margin: margin } });
            toast.success('Ambang & margin disimpan ke pengaturan pemilihan.');
            qc.invalidateQueries({ queryKey: ['election'] });
        } catch (e) {
            toast.error(errorMessage(e));
        }
    }

    const bench = benchRef.current;
    const avg = (k) => (bench.length ? bench.reduce((a, b) => a + (b[k] || 0), 0) / bench.length : 0);
    const labels = [...new Set(samples.map((s) => s.label))];

    return (
        <div className="space-y-6">
            <p className="text-sm text-slate-600">
                Untuk gerbang Fase 3: kumpulkan ≥ 3 sampel per sukarelawan dari 20–30 orang dalam berbagai kondisi. Data uji hanya ada di peramban ini (ekspor JSON untuk disimpan; hapus setelah selesai). Hasil dari tab <b>Uji cepat</b> juga bisa disimpan ke sini.
            </p>

            <section className="card grid gap-6 lg:grid-cols-2">
                <div>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-950">
                        <video ref={videoRef} className="mirror h-full w-full object-cover" playsInline muted />
                        {!cameraOn && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                                <IconCamera className="size-10 text-slate-500" />
                                <span className="text-sm">Kamera mati</span>
                            </div>
                        )}
                    </div>
                    {camError && <Alert type="danger" className="mt-2">{camError}</Alert>}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            className="btn-secondary btn-sm"
                            onClick={() => {
                                cameraOn ? stop() : start();
                                setCameraOn(!cameraOn);
                            }}
                        >
                            {cameraOn ? 'Matikan kamera' : 'Nyalakan kamera'}
                        </button>
                        <button className="btn-secondary btn-sm" disabled={!cameraOn} onClick={() => (sessionRef.current = createLivenessSession())}>
                            Uji liveness
                        </button>
                    </div>
                    {liveness && (
                        <p className="mt-2 text-sm">
                            Liveness:{' '}
                            {liveness.done ? (
                                liveness.passed ? (
                                    <Badge color="green">LULUS</Badge>
                                ) : (
                                    <Badge color="red">GAGAL — {liveness.message}</Badge>
                                )
                            ) : (
                                <span>
                                    {liveness.message} ({liveness.index}/{liveness.total})
                                </span>
                            )}
                        </p>
                    )}
                </div>
                <div className="space-y-3 text-sm">
                    <h2 className="font-extrabold text-slate-900">Pengukuran langsung</h2>
                    {live?.error && <Alert type="danger">{live.error}</Alert>}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl bg-slate-50 p-3.5">
                        <dt className="text-slate-500">Wajah terdeteksi</dt>
                        <dd className="font-mono font-semibold">{live?.faces ?? '—'}</dd>
                        <dt className="text-slate-500">Skor deteksi</dt>
                        <dd className="font-mono font-semibold">{live?.score?.toFixed(3) ?? '—'}</dd>
                        <dt className="text-slate-500">Lebar wajah</dt>
                        <dd className="font-mono font-semibold">{live?.width ? `${Math.round(live.width)} px` : '—'}</dd>
                        <dt className="text-slate-500">Ketajaman / kecerahan</dt>
                        <dd className="font-mono font-semibold">{live?.quality ? `${live.quality.sharpness.toFixed(0)} / ${live.quality.brightness.toFixed(0)}` : '—'}</dd>
                        <dt className="text-slate-500">Kedip / rasio toleh</dt>
                        <dd className="font-mono font-semibold">{live?.frame?.faces ? `${live.frame.blink.toFixed(2)} / ${live.frame.yaw.toFixed(2)}` : '—'}</dd>
                        <dt className="text-slate-500">Vektor (8 pertama)</dt>
                        <dd className="font-mono text-[11px] break-all">{live?.embedding ? live.embedding.slice(0, 8).map((v) => v.toFixed(3)).join(', ') : '—'}</dd>
                    </dl>
                    <h3 className="pt-1 font-bold text-slate-900">Waktu proses (rata-rata {bench.length} frame)</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl bg-slate-50 p-3.5">
                        <dt className="text-slate-500">Landmark (liveness)</dt>
                        <dd className="font-mono font-semibold">{avg('l').toFixed(0)} ms</dd>
                        <dt className="text-slate-500">Deteksi ({DETECTION.kioskSize}px)</dt>
                        <dd className="font-mono font-semibold">{avg('d').toFixed(0)} ms</dd>
                        <dt className="text-slate-500">Embedding</dt>
                        <dd className="font-mono font-semibold">{avg('e').toFixed(0)} ms</dd>
                        <dt className="text-slate-500">Muat model</dt>
                        <dd className="font-mono font-semibold">{lastTimings().load ? `${(lastTimings().load / 1000).toFixed(1)} s` : '—'}</dd>
                    </dl>
                    <p className="text-xs text-slate-500">Catat angka ini dari tablet NYATA ke docs/PROGRESS.md. Gerbang: total identifikasi &gt; 3 detik → evaluasi ulang.</p>
                    <p className="text-xs text-slate-400">
                        {navigator.userAgent} · {navigator.hardwareConcurrency} inti
                    </p>
                </div>
            </section>

            <section className="card space-y-4">
                <h2 className="font-extrabold text-slate-900">Kumpulkan sampel</h2>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Kode sukarelawan (mis. S01)">{(id) => <input id={id} className="input" value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
                    <Field label="Kondisi">
                        {(id) => (
                            <select id={id} className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
                                {['normal', 'redup', 'terang', 'kacamata', 'kerudung/peci', 'jauh', 'dekat'].map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        )}
                    </Field>
                    <button className="btn-primary" onClick={addLiveSample} disabled={!live?.embedding}>
                        Ambil sampel dari kamera
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <label className="btn-secondary btn-sm">
                        Tambah dari foto (nama: KODE_x.jpg)
                        <input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => addFiles([...e.target.files])} />
                    </label>
                    <label className="btn-secondary btn-sm">
                        Impor JSON
                        <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files[0] && importJson(e.target.files[0])} />
                    </label>
                    <button className="btn-secondary btn-sm" onClick={exportJson} disabled={!samples.length}>
                        Ekspor JSON
                    </button>
                    <button className="btn-ghost btn-sm text-crimson-700 hover:bg-crimson-50" onClick={() => confirm('Hapus semua sampel dari memori?') && setSamples([])} disabled={!samples.length}>
                        Hapus sampel
                    </button>
                </div>
                <p className="text-sm font-medium text-slate-600">
                    {samples.length} sampel · {labels.length} sukarelawan
                </p>
            </section>

            {analysis && (
                <section className="card space-y-5">
                    <h2 className="font-extrabold text-slate-900">Laporan akurasi</h2>
                    <Histogram genuine={analysis.genuine} impostor={analysis.impostor} />

                    {analysis.rec ? (
                        <Alert type="info" title={`Rekomendasi: AMBANG ${analysis.rec.threshold} · MARGIN ${analysis.rec.margin}`}>
                            FAR per-pembanding {pct(analysis.rec.far)} → perkiraan salah-cocok 1:N (N={population}) {pct(analysis.rec.far1N)} · FRR {pct(analysis.rec.frr)} · impostor tertinggi{' '}
                            {analysis.rec.maxImpostor.toFixed(3)} · genuine terendah {analysis.rec.minGenuine.toFixed(3)}. Dengan sampel kecil, estimasi FAR tidak presisi — tambah sukarelawan.
                        </Alert>
                    ) : (
                        <Alert type="warning">Butuh minimal 5 pasangan genuine dan 20 pasangan impostor untuk rekomendasi.</Alert>
                    )}

                    <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
                        <Field label="Jumlah pemilih (N)">{(id) => <input id={id} type="number" className="input" value={population} onChange={(e) => setPopulation(Number(e.target.value))} />}</Field>
                        <Field label="Ambang uji">{(id) => <input id={id} type="number" step="0.01" className="input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />}</Field>
                        <Field label="Margin uji">{(id) => <input id={id} type="number" step="0.01" className="input" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />}</Field>
                        <div className="flex flex-wrap gap-2">
                            {analysis.rec && (
                                <button
                                    className="btn-secondary btn-sm"
                                    onClick={() => {
                                        setThreshold(analysis.rec.threshold);
                                        setMargin(analysis.rec.margin);
                                    }}
                                >
                                    Pakai rekomendasi
                                </button>
                            )}
                            <button className="btn-primary btn-sm" onClick={applySettings}>
                                Simpan ke pengaturan
                            </button>
                        </div>
                    </div>

                    {sim && (
                        <p className="text-sm">
                            Simulasi identifikasi 1:N ({sim.gallery} galeri, {sim.probes} probe): <Badge color="green">benar {sim.correct}</Badge>{' '}
                            <Badge color="red">salah-kenal {sim.wrong}</Badge> <Badge color="yellow">ditolak → cadangan {sim.rejected}</Badge>
                        </p>
                    )}

                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Ambang</th>
                                    <th>FAR</th>
                                    <th>FAR 1:N</th>
                                    <th>FRR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 13 }, (_, i) => 0.3 + i * 0.05).map((t) => {
                                    const r = rates(analysis.genuine, analysis.impostor, t);
                                    return (
                                        <tr key={t} className={Math.abs(t - threshold) < 0.026 ? 'bg-brand-50/70 font-semibold' : ''}>
                                            <td className="font-mono">{t.toFixed(2)}</td>
                                            <td className="font-mono">{pct(r.far)}</td>
                                            <td className="font-mono">{pct(farOneToN(r.far, population))}</td>
                                            <td className="font-mono">{pct(r.frr)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}

const TABS = [
    ['quick', 'Uji cepat', 'Unggah foto → scan wajah → lihat cocok atau tidak'],
    ['advanced', 'Uji akurasi (lanjutan)', 'Sampel sukarelawan, FAR/FRR, rekomendasi ambang'],
];

export default function UjiWajah() {
    const { data: election } = useElection();
    const [tab, setTab] = useState('quick');
    const [engine, setEngine] = useState({ state: 'loading', progress: 0, label: 'Memuat model', error: null });
    const [livenessReady, setLivenessReady] = useState(false);
    const [samples, setSamples] = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                await loadFaceEngine((p, label) => alive && setEngine((s) => ({ ...s, progress: p, label: label || s.label })));
                if (alive) setEngine({ state: 'ready', progress: 1, label: 'Siap', error: null });
            } catch (e) {
                if (alive) setEngine({ state: 'error', progress: 0, label: '', error: e.message });
                return;
            }
            // Liveness opsional: bila gagal dimuat, uji cepat tetap jalan tanpa liveness.
            try {
                await loadLiveness();
                if (alive) setLivenessReady(true);
            } catch {
                if (alive) setLivenessReady(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const threshold = Number(election?.settings?.match_threshold ?? 0.5);
    const margin = Number(election?.settings?.match_margin ?? 0.08);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    <IconFaceScan className="size-7 text-brand-700" />
                    Uji Wajah
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">Coba pengenalan wajah sebelum hari-H. Semua pemrosesan terjadi di peramban ini; foto dan wajah tidak dikirim ke server.</p>
            </div>

            {engine.state === 'loading' && (
                <div className="card space-y-2.5" role="status">
                    <div className="flex justify-between text-sm font-medium">
                        <span>{engine.label}… (unduhan pertama ±20 MB, berikutnya dari cache)</span>
                        <span className="font-mono font-bold text-brand-700 tabular-nums">{Math.round(engine.progress * 100)}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                        <div className="h-2.5 rounded-full bg-gradient-to-r from-brand-700 to-brand-500 transition-all" style={{ width: `${Math.round(engine.progress * 100)}%` }} />
                    </div>
                </div>
            )}
            {engine.error && (
                <Alert type="danger" title="Model wajah gagal dimuat">
                    {engine.error}. Pastikan berkas di <code>public/models/</code> tersedia lalu muat ulang halaman.
                </Alert>
            )}

            <div role="tablist" aria-label="Mode uji" className="grid gap-3 sm:grid-cols-2">
                {TABS.map(([key, label, desc]) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`rounded-2xl border-2 p-4 text-left transition ${
                            tab === key ? 'border-brand-700 bg-brand-50/70 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                        <span className={`block font-extrabold ${tab === key ? 'text-brand-900' : 'text-slate-900'}`}>
                            {label}
                            {key === 'advanced' && samples.length > 0 && <span className="ml-2 text-xs font-semibold text-brand-700">({samples.length} sampel)</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-600 sm:text-sm">{desc}</span>
                    </button>
                ))}
            </div>

            {tab === 'quick' ? (
                <UjiWajahCepat
                    engine={engine}
                    livenessReady={livenessReady}
                    threshold={threshold}
                    margin={margin}
                    onAddSamples={(list) => setSamples((s) => [...s, ...list])}
                />
            ) : (
                <AdvancedTest engine={engine} samples={samples} setSamples={setSamples} />
            )}
        </div>
    );
}
