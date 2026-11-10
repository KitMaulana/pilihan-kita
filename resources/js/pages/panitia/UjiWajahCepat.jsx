import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from '../../features/face/useCamera';
import { cosine, detectFaces, embedFace, lastTimings, loadImageFile } from '../../features/face/faceEngine';
import { analyzeFrame, createLivenessSession } from '../../features/face/liveness';
import { assessEnrollment, measureQuality } from '../../features/face/quality';
import { DETECTION, QUALITY } from '../../features/face/config';
import { Alert, Badge, toast } from '../../components/ui';

const SCAN_FRAMES = 5; // jumlah frame wajah layak yang dirata-rata
const SCAN_TIMEOUT_MS = 15000;

/** Rata-rata beberapa embedding lalu normalisasi L2 → probe yang lebih stabil. */
function meanEmbedding(list) {
    const out = new Array(list[0].length).fill(0);
    for (const e of list) for (let i = 0; i < e.length; i++) out[i] += e[i];
    const n = Math.sqrt(out.reduce((a, v) => a + v * v, 0)) || 1;
    return out.map((v) => v / n);
}

function fileLabel(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Tanpa nama';
}

/* ── Langkah 1: foto acuan ──────────────────────────────────────────────── */
function ReferenceCard({ ref_, onRename, onRemove }) {
    return (
        <li className={`flex gap-3 rounded-xl border p-3 ${ref_.status === 'ok' ? 'border-emerald-200 bg-emerald-50/40' : ref_.status === 'error' ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
            <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <img src={ref_.preview} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                <input className="input min-h-10 py-1.5 text-sm" value={ref_.label} onChange={(e) => onRename(e.target.value)} aria-label="Nama pemilik foto" />
                {ref_.status === 'processing' && <p className="text-xs text-slate-500">Memproses…</p>}
                {ref_.status === 'ok' && (
                    <p className="text-xs text-emerald-700">
                        ✓ Wajah terbaca{ref_.warnings.length > 0 && <span className="text-amber-700"> · {ref_.warnings.join('; ')}</span>}
                    </p>
                )}
                {ref_.status === 'error' && <p className="text-xs text-red-700">✗ {ref_.error}</p>}
            </div>
            <button className="btn-ghost btn-sm self-start text-red-700" onClick={onRemove} aria-label={`Hapus foto ${ref_.label}`}>
                ✕
            </button>
        </li>
    );
}

/* ── Hasil ──────────────────────────────────────────────────────────────── */
function ResultCard({ result, threshold, margin, onRescan, onSave }) {
    const { ranked, verdict, timings, livenessPassed } = result;
    const tone = {
        match: { box: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-800', icon: '✓' },
        ambiguous: { box: 'border-amber-300 bg-amber-50', text: 'text-amber-800', icon: '?' },
        nomatch: { box: 'border-red-300 bg-red-50', text: 'text-red-800', icon: '✗' },
    }[verdict.kind];

    return (
        <div className="space-y-4">
            <div className={`rounded-2xl border-2 p-5 ${tone.box}`} role="status">
                <div className="flex items-center gap-4">
                    <span className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-3xl font-black ${tone.text}`}>{tone.icon}</span>
                    <div>
                        <p className={`text-xl font-bold ${tone.text}`}>{verdict.title}</p>
                        <p className="text-sm text-slate-700">{verdict.detail}</p>
                    </div>
                </div>
            </div>

            <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Skor kemiripan per foto acuan</h4>
                <ul className="space-y-2">
                    {ranked.map((r, i) => {
                        const pct = Math.max(0, Math.min(1, r.score));
                        return (
                            <li key={r.id}>
                                <div className="flex justify-between text-sm">
                                    <span className={i === 0 ? 'font-semibold' : ''}>{r.label}</span>
                                    <span className="font-mono tabular-nums">{r.score.toFixed(3)}</span>
                                </div>
                                <div className="relative mt-1 h-3 rounded-full bg-slate-100">
                                    <div className={`h-3 rounded-full ${r.score >= threshold ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${pct * 100}%` }} />
                                    <div className="absolute -top-1 h-5 w-0.5 bg-slate-800" style={{ left: `${threshold * 100}%` }} title={`Ambang ${threshold}`} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                    Garis hitam = ambang {threshold.toFixed(2)}. Aturan server: skor tertinggi ≥ ambang <b>dan</b> selisih dengan peringkat 2 ≥ margin {margin.toFixed(2)}.
                </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
                <dt className="text-slate-500">Deteksi</dt>
                <dd>{timings.detect.toFixed(0)} ms</dd>
                <dt className="text-slate-500">Embedding</dt>
                <dd>{timings.embed.toFixed(0)} ms</dd>
                <dt className="text-slate-500">Lama scan</dt>
                <dd>{(timings.total / 1000).toFixed(1)} dtk</dd>
                <dt className="text-slate-500">Liveness</dt>
                <dd>{livenessPassed === null ? 'tidak diuji' : livenessPassed ? 'lulus' : 'gagal'}</dd>
            </dl>

            <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={onRescan}>
                    Scan ulang
                </button>
                {verdict.kind !== 'nomatch' && (
                    <button className="btn-secondary" onClick={() => onSave(ranked[0].label)}>
                        Benar, ini {ranked[0].label} — simpan ke data akurasi
                    </button>
                )}
                <button className="btn-ghost" onClick={() => onSave(null)}>
                    Simpan sebagai orang lain
                </button>
            </div>
        </div>
    );
}

/* ── Halaman uji cepat ──────────────────────────────────────────────────── */
export default function UjiWajahCepat({ engine, livenessReady, threshold, margin, onAddSamples }) {
    const [refs, setRefs] = useState([]);
    const [useLiveness, setUseLiveness] = useState(false);
    const [phase, setPhase] = useState('idle'); // idle | liveness | scanning | result | failed
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const { videoRef, status: camStatus, error: camError, start, stop } = useCamera({ autoStart: false });
    const fileInput = useRef(null);
    const refsRef = useRef(refs);
    refsRef.current = refs;
    const livenessRef = useRef(null); // null = tidak diuji, true/false = hasil liveness scan terakhir

    // Bersihkan URL pratinjau saat halaman ditinggalkan.
    useEffect(() => () => refsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

    const ready = engine.state === 'ready';
    const validRefs = refs.filter((r) => r.status === 'ok');

    async function addFiles(files) {
        const images = [...files].filter((f) => f.type.startsWith('image/'));
        if (!images.length) return toast.error('Pilih berkas gambar (JPG/PNG).');
        if (!ready) return toast.error('Model wajah belum siap.');
        for (const f of images) {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const entry = { id, label: fileLabel(f.name), preview: URL.createObjectURL(f), status: 'processing', warnings: [], error: null, embedding: null };
            setRefs((r) => [...r, entry]);
            let patch;
            try {
                const bmp = await loadImageFile(f);
                const faces = await detectFaces(bmp, DETECTION.enrollSize);
                if (faces.length === 0) {
                    patch = { status: 'error', error: 'Tidak ada wajah terdeteksi. Gunakan foto wajah tampak depan yang jelas.' };
                } else if (faces.length > 1) {
                    patch = { status: 'error', error: `Terdeteksi ${faces.length} wajah — foto acuan harus berisi tepat 1 orang.` };
                } else {
                    const { embedding, aligned } = await embedFace(bmp, faces[0]);
                    const q = assessEnrollment(faces, measureQuality(aligned));
                    patch = { status: 'ok', embedding, warnings: q.reasons };
                }
                bmp.close?.();
            } catch (e) {
                patch = { status: 'error', error: `Gagal memproses: ${e.message}` };
            }
            setRefs((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
        }
    }

    function removeRef(id) {
        setRefs((r) => {
            const t = r.find((x) => x.id === id);
            if (t) URL.revokeObjectURL(t.preview);
            return r.filter((x) => x.id !== id);
        });
    }

    const beginScan = useCallback(async () => {
        setResult(null);
        setProgress(0);
        livenessRef.current = null;
        await start();
        setPhase(useLiveness && livenessReady ? 'liveness' : 'scanning');
        setMessage('Posisikan wajah di dalam oval');
    }, [start, useLiveness, livenessReady]);

    function cancelScan() {
        stop();
        setPhase('idle');
        setMessage('');
    }

    // Loop scan: liveness (opsional) → kumpulkan SCAN_FRAMES embedding → bandingkan dengan foto acuan.
    useEffect(() => {
        if (camStatus !== 'ready' || (phase !== 'liveness' && phase !== 'scanning')) return;
        let alive = true, raf = 0, busy = false, last = 0;
        const t0 = performance.now();
        const embeddings = [];
        const times = { detect: 0, embed: 0 };
        let liveSession = phase === 'liveness' ? createLivenessSession() : null;
        if (phase === 'liveness') livenessRef.current = false;
        let stage = phase;

        const finish = (ok, msg) => {
            alive = false;
            stop();
            if (!ok) {
                setPhase('failed');
                setMessage(msg);
                return;
            }
            const probe = meanEmbedding(embeddings);
            const ranked = refsRef.current
                .filter((r) => r.status === 'ok')
                .map((r) => ({ id: r.id, label: r.label, score: cosine(probe, r.embedding) }))
                .sort((a, b) => b.score - a.score);
            const s1 = ranked[0]?.score ?? -1;
            const s2 = ranked[1]?.score ?? -1;
            let verdict;
            if (s1 < threshold) {
                verdict = { kind: 'nomatch', title: 'Tidak cocok / tidak dikenali', detail: `Skor tertinggi ${s1.toFixed(3)} di bawah ambang ${threshold.toFixed(2)}. Di kiosk, pemilih akan diarahkan ke jalur cadangan.` };
            } else if (ranked.length > 1 && s1 - s2 < margin) {
                verdict = { kind: 'ambiguous', title: `Ambigu: ${ranked[0].label} atau ${ranked[1].label}`, detail: `Selisih skor ${(s1 - s2).toFixed(3)} di bawah margin ${margin.toFixed(2)}. Di kiosk, ini ditolak demi keamanan → jalur cadangan.` };
            } else {
                verdict = { kind: 'match', title: `Cocok: ${ranked[0].label}`, detail: `Skor ${s1.toFixed(3)} ≥ ambang ${threshold.toFixed(2)}${ranked.length > 1 ? `, selisih dengan peringkat 2 = ${(s1 - s2).toFixed(3)}` : ''}.` };
            }
            const n = embeddings.length || 1;
            setResult({
                ranked,
                verdict,
                probe,
                livenessPassed: livenessRef.current,
                timings: { detect: times.detect / n, embed: times.embed / n, total: performance.now() - t0 },
            });
            setPhase('result');
        };

        const loop = async () => {
            if (!alive) return;
            const v = videoRef.current;
            const elapsed = performance.now() - t0;

            if (stage === 'liveness') {
                const r = liveSession.step(analyzeFrame(v));
                setMessage(r.message);
                setProgress(r.total ? r.index / r.total : 0);
                if (r.done) {
                    if (!r.passed) return finish(false, `Liveness gagal: ${r.message}. Di kiosk, pemilih diarahkan ke jalur cadangan dan kejadian dicatat.`);
                    livenessRef.current = true;
                    liveSession = null;
                    stage = 'scanning';
                    setPhase('scanning');
                    return; // efek dijalankan ulang untuk tahap scanning
                }
            } else if (!busy && performance.now() - last > 200) {
                if (elapsed > SCAN_TIMEOUT_MS) {
                    return finish(false, 'Wajah tidak terbaca dengan baik dalam 15 detik. Periksa pencahayaan dan jarak, lalu coba lagi.');
                }
                busy = true;
                last = performance.now();
                try {
                    const faces = await detectFaces(v, DETECTION.kioskSize);
                    if (!alive) return;
                    if (faces.length === 0) setMessage('Wajah belum terlihat — hadap ke kamera');
                    else if (faces.length > 1) setMessage('Hanya satu orang di depan kamera');
                    else if ((faces[0].box[2] - faces[0].box[0]) / v.videoWidth < QUALITY.minFaceRatioKiosk) setMessage('Dekatkan wajah ke kamera');
                    else {
                        const { embedding } = await embedFace(v, faces[0]);
                        const t = lastTimings();
                        times.detect += t.detect;
                        times.embed += t.embed;
                        embeddings.push(embedding);
                        setProgress(embeddings.length / SCAN_FRAMES);
                        setMessage('Tahan posisi… memindai');
                        if (embeddings.length >= SCAN_FRAMES) return finish(true);
                    }
                } catch (e) {
                    return finish(false, `Galat mesin wajah: ${e.message}`);
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
        // threshold/margin dibaca saat selesai; tidak perlu memulai ulang scan bila berubah.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camStatus, phase]);

    function saveSamples(label) {
        if (!result) return;
        const name = label || `orang-lain-${Date.now().toString(36)}`;
        const samples = [{ label: name, condition: 'scan', embedding: result.probe, source: 'uji cepat (kamera)' }];
        // Sertakan foto acuan sekali saja (berdasarkan id) agar pasangan genuine/impostor terbentuk.
        for (const r of validRefs) {
            if (!r.savedAsSample) samples.push({ label: r.label, condition: 'foto', embedding: r.embedding, source: 'uji cepat (foto acuan)' });
        }
        setRefs((rs) => rs.map((r) => (r.status === 'ok' ? { ...r, savedAsSample: true } : r)));
        onAddSamples(samples);
        toast.success(`${samples.length} sampel disimpan ke tab Uji akurasi.`);
    }

    const scanning = phase === 'liveness' || phase === 'scanning';

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Langkah 1 */}
            <section className="card space-y-4">
                <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 font-bold text-white">1</span>
                    <h2 className="text-lg font-bold">Unggah foto acuan</h2>
                </div>
                <p className="text-sm text-slate-600">
                    Unggah pas foto orang yang akan diuji (boleh beberapa orang sekaligus untuk menguji pencocokan 1:N). Foto <b>hanya diproses di peramban ini</b> dan tidak dikirim ke server.
                </p>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInput.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        addFiles(e.dataTransfer.files);
                    }}
                    className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                        dragOver ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50'
                    } ${ready ? '' : 'pointer-events-none opacity-50'}`}
                >
                    <svg viewBox="0 0 24 24" className="size-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 4v12M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="font-semibold text-slate-700">Ketuk untuk memilih foto</span>
                    <span className="text-xs text-slate-500">atau seret &amp; lepas di sini · JPG/PNG · nama berkas dipakai sebagai nama</span>
                    <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                            addFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />
                </div>
                {refs.length > 0 && (
                    <>
                        <ul className="space-y-2">
                            {refs.map((r) => (
                                <ReferenceCard key={r.id} ref_={r} onRename={(label) => setRefs((rs) => rs.map((x) => (x.id === r.id ? { ...x, label } : x)))} onRemove={() => removeRef(r.id)} />
                            ))}
                        </ul>
                        <p className="text-sm text-slate-600">
                            {validRefs.length} dari {refs.length} foto siap dipakai.
                        </p>
                    </>
                )}
            </section>

            {/* Langkah 2 */}
            <section className="card space-y-4">
                <div className="flex items-center gap-3">
                    <span className={`flex size-8 items-center justify-center rounded-full font-bold text-white ${validRefs.length ? 'bg-brand-700' : 'bg-slate-300'}`}>2</span>
                    <h2 className="text-lg font-bold">Scan wajah</h2>
                </div>

                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-900">
                    <video ref={videoRef} className={`mirror h-full w-full object-cover ${scanning ? '' : 'invisible'}`} playsInline muted />
                    {scanning && (
                        <>
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="aspect-[3/4] h-[78%] rounded-[50%] border-4 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/70 p-3 text-center text-white">
                                <p className="font-semibold">{message}</p>
                                <div className="mx-auto mt-2 h-1.5 max-w-xs rounded-full bg-white/20">
                                    <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                                </div>
                                <p className="mt-1 text-xs text-white/70">{phase === 'liveness' ? 'Tahap 1/2: uji liveness' : `Tahap ${useLiveness && livenessReady ? '2/2' : '1/1'}: memindai wajah`}</p>
                            </div>
                        </>
                    )}
                    {!scanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
                            {phase === 'result' ? <span>Scan selesai — kamera dimatikan.</span> : validRefs.length ? <span>Siap. Tekan “Mulai scan wajah”.</span> : <span>Unggah minimal satu foto acuan dulu.</span>}
                        </div>
                    )}
                </div>
                {camError && <Alert type="danger">{camError}</Alert>}

                {!scanning && phase !== 'result' && (
                    <div className="space-y-3">
                        <label className={`flex items-center gap-2 text-sm ${livenessReady ? '' : 'opacity-50'}`}>
                            <input type="checkbox" className="size-5" checked={useLiveness && livenessReady} disabled={!livenessReady} onChange={(e) => setUseLiveness(e.target.checked)} />
                            Sertakan uji liveness (kedip &amp; toleh) seperti di kiosk {!livenessReady && '— model liveness belum termuat'}
                        </label>
                        <button className="btn-primary w-full text-lg" disabled={!ready || validRefs.length === 0} onClick={beginScan}>
                            ▶ Mulai scan wajah
                        </button>
                    </div>
                )}
                {scanning && (
                    <button className="btn-secondary w-full" onClick={cancelScan}>
                        Batalkan
                    </button>
                )}
                {phase === 'failed' && (
                    <Alert type="warning" title="Scan belum berhasil">
                        {message}
                    </Alert>
                )}
                {phase === 'result' && result && <ResultCard result={result} threshold={threshold} margin={margin} onRescan={beginScan} onSave={saveSamples} />}

                <details className="text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold">Tips agar hasil akurat</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Wajah menghadap sumber cahaya (jangan membelakangi jendela).</li>
                        <li>Jarak ±40–60 cm, wajah memenuhi oval.</li>
                        <li>Lepas masker; kacamata/kerudung boleh, uji juga kondisi tersebut.</li>
                        <li>Pakai foto acuan yang tajam, tampak depan, satu orang.</li>
                    </ul>
                </details>
                <Badge color="gray">
                    Ambang {threshold.toFixed(2)} · margin {margin.toFixed(2)} (dari pengaturan pemilihan)
                </Badge>
            </section>
        </div>
    );
}
