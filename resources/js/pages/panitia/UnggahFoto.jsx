import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { number, percent } from '../../lib/format';
import { detectFaces, embedFace, loadFaceEngine, loadImageFile } from '../../features/face/faceEngine';
import { assessEnrollment, measureQuality } from '../../features/face/quality';
import { DETECTION, MODEL_VERSION } from '../../features/face/config';
import { IconUpload } from '../../components/Icons';
import { IMAGE_ACCEPT, IMAGE_LABEL, IMAGE_NAME } from '../../lib/image';
import { Alert, Badge, ProgressBar, Spinner } from '../../components/ui';

/** Nama berkas → kunci pemilih: "0071234567.jpg" → "0071234567", "id-15.png" → "id-15". */
function keyFromFile(name) {
    const base = name.replace(/\.[^.]+$/, '').trim();
    const m = base.match(/^id-\d+$/i);
    if (m) return base.toLowerCase();
    return base.replace(/[\s.\-_]/g, '');
}

const ACCEPT = IMAGE_NAME; // JPG, PNG, WebP, GIF, BMP, AVIF, HEIC/HEIF

/**
 * Unggah pas foto: SETIAP foto diproses di browser panitia (deteksi → cek kualitas →
 * embedding). Hanya vektor yang dikirim. Foto tidak pernah diunggah ke server.
 */
export default function UnggahFoto() {
    const qc = useQueryClient();
    const [engine, setEngine] = useState({ state: 'idle', progress: 0, error: null });
    const [items, setItems] = useState([]);
    const [running, setRunning] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const stopRef = useRef(false);

    const status = useQuery({ queryKey: ['face-status'], queryFn: () => api.get('/panitia/face-templates/status').then((r) => r.data), refetchInterval: running ? 5000 : false });

    async function ensureEngine() {
        if (engine.state === 'ready') return true;
        setEngine({ state: 'loading', progress: 0, error: null });
        try {
            await loadFaceEngine((p) => setEngine((s) => ({ ...s, progress: p })));
            setEngine({ state: 'ready', progress: 1, error: null });
            return true;
        } catch (e) {
            setEngine({ state: 'error', progress: 0, error: e.message });
            return false;
        }
    }

    async function onFiles(fileList) {
        const files = [...fileList].filter((f) => ACCEPT.test(f.name));
        if (!files.length) return;
        const keys = [...new Set(files.map((f) => keyFromFile(f.name)))];
        let map = {};
        try {
            // Server membatasi 2.000 kunci per permintaan.
            for (let i = 0; i < keys.length; i += 2000) {
                const { data } = await api.post('/panitia/face-templates/lookup', { keys: keys.slice(i, i + 2000) });
                map = { ...map, ...data.data };
            }
        } catch (e) {
            setItems([{ name: '—', status: 'error', reasons: [errorMessage(e)] }]);
            return;
        }
        setItems(
            files.map((file) => {
                const key = keyFromFile(file.name);
                const voter = map[key];
                return {
                    file,
                    name: file.name,
                    key,
                    voter,
                    status: voter ? 'queued' : 'error',
                    reasons: voter ? [] : ['Nama berkas tidak cocok dengan NISN/NIP/ID pemilih mana pun'],
                };
            }),
        );
    }

    async function processAll() {
        if (!(await ensureEngine())) return;
        setRunning(true);
        stopRef.current = false;

        for (let i = 0; i < items.length; i++) {
            if (stopRef.current) break;
            const it = items[i];
            if (it.status !== 'queued') continue;
            if (it.voter.has_face && !overwrite) {
                update(i, { status: 'skipped', reasons: ['Sudah terdaftar (centang "timpa" untuk mengganti)'] });
                continue;
            }
            update(i, { status: 'processing' });
            let bitmap = null;
            try {
                bitmap = await loadImageFile(it.file);
                const faces = await detectFaces(bitmap, DETECTION.enrollSize);
                if (!faces.length) {
                    update(i, { status: 'error', reasons: ['Tidak ada wajah terdeteksi'] });
                    continue;
                }
                const { embedding, aligned } = await embedFace(bitmap, faces[0]);
                const q = assessEnrollment(faces, measureQuality(aligned));
                const thumb = aligned.toDataURL('image/jpeg', 0.7); // hanya untuk pratinjau lokal
                if (!q.ok) {
                    update(i, { status: 'error', reasons: q.reasons, thumb });
                    continue;
                }
                const { data } = await api.post('/panitia/face-templates', {
                    voter_id: it.voter.id,
                    embedding,
                    model_version: MODEL_VERSION,
                    quality_score: q.score,
                });
                update(i, {
                    status: data.duplicate ? 'warning' : 'done',
                    reasons: data.duplicate ? [`Sangat mirip dengan ${data.duplicate.name} (${data.duplicate.class_name}), skor ${data.duplicate.score}`] : [],
                    quality: q.score,
                    thumb,
                });
            } catch (e) {
                update(i, { status: 'error', reasons: [e.response ? errorMessage(e) : e.message] });
            } finally {
                bitmap?.close?.();
            }
        }
        setRunning(false);
        qc.invalidateQueries({ queryKey: ['face-status'] });
        qc.invalidateQueries({ queryKey: ['voters'] });
    }

    function update(i, patch) {
        setItems((arr) => {
            const next = [...arr];
            next[i] = { ...next[i], ...patch };
            return next;
        });
    }

    const counts = items.reduce((acc, it) => ({ ...acc, [it.status]: (acc[it.status] || 0) + 1 }), {});
    const doneCount = (counts.done || 0) + (counts.warning || 0) + (counts.error || 0) + (counts.skipped || 0);
    const failed = items.filter((it) => it.status === 'error' || it.status === 'warning');

    const STATUS = {
        queued: <Badge>Antre</Badge>,
        processing: <Badge color="blue">Memproses…</Badge>,
        done: <Badge color="green">Terdaftar</Badge>,
        warning: <Badge color="yellow">Terdaftar · cek ganda</Badge>,
        skipped: <Badge>Dilewati</Badge>,
        error: <Badge color="red">Gagal</Badge>,
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Unggah Pas Foto</h1>
                <p className="mt-0.5 text-sm text-slate-500">Ekstrak vektor wajah langsung di browser — foto asli tidak pernah dikirim ke server.</p>
            </div>

            {status.data && (
                <section className="card">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-bold text-slate-900">
                            {number(status.data.registered)} dari {number(status.data.total)} pemilih terdaftar wajah
                        </p>
                        <p className="text-sm font-medium text-slate-500">
                            <span className="font-mono font-bold text-emerald-700">{percent(status.data.registered, status.data.total)}%</span> · target ≥ 98% · {status.data.duplicates} ditandai ganda
                        </p>
                    </div>
                    <div className="mt-2.5">
                        <ProgressBar value={percent(status.data.registered, status.data.total)} color="bg-gradient-to-r from-emerald-600 to-emerald-500" label="Progres pendaftaran wajah" />
                    </div>
                </section>
            )}

            <Alert type="info" title="Cara pakai">
                Beri nama berkas sesuai <strong>NISN</strong> (siswa) atau <strong>NIP</strong> (guru), mis. <code>0071234567.jpg</code>. Guru tanpa NIP: <code>id-&lt;ID pemilih&gt;.jpg</code> (ID terlihat di menu Pemilih). Pilih banyak berkas sekaligus atau satu folder. Syarat: tepat 1 wajah, menghadap depan, terang, tidak buram.
            </Alert>

            <section className="card space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center transition hover:border-brand-500 hover:bg-brand-50/40">
                        <IconUpload className="size-6 text-brand-700" />
                        <span className="text-sm font-bold text-slate-800">Pilih berkas foto</span>
                        <span className="text-xs text-slate-500">{IMAGE_LABEL} (bisa banyak sekaligus)</span>
                        <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={running} />
                    </label>
                    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4 text-center transition hover:border-brand-500 hover:bg-brand-50/40">
                        <IconUpload className="size-6 text-brand-700" />
                        <span className="text-sm font-bold text-slate-800">Pilih satu folder</span>
                        <span className="text-xs text-slate-500">Muat seluruh folder pas foto kelas/sekolah</span>
                        <input type="file" webkitdirectory="" directory="" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={running} />
                    </label>
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="size-5 rounded accent-brand-700" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                    Timpa template yang sudah ada
                </label>

                {engine.state === 'loading' && (
                    <div>
                        <Spinner label={`Memuat model wajah… ${Math.round(engine.progress * 100)}%`} />
                    </div>
                )}
                {engine.error && <Alert type="danger" title="Model gagal dimuat">{engine.error}</Alert>}

                {items.length > 0 && (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                            <p className="text-sm font-medium text-slate-600">
                                {items.length} berkas · selesai {doneCount} · gagal {counts.error || 0} · perlu dicek {counts.warning || 0}
                            </p>
                            <div className="flex gap-2">
                                {running ? (
                                    <button className="btn-secondary" onClick={() => (stopRef.current = true)}>
                                        Hentikan
                                    </button>
                                ) : (
                                    <button className="btn-primary" onClick={processAll} disabled={!counts.queued}>
                                        Proses {counts.queued || 0} foto
                                    </button>
                                )}
                            </div>
                        </div>
                        <ProgressBar value={percent(doneCount, items.length)} label="Progres pemrosesan" />

                        {failed.length > 0 && !running && (
                            <div>
                                <h2 className="mb-2 text-sm font-bold text-crimson-700">Foto gagal / perlu dicek ({failed.length})</h2>
                                <ul className="divide-y divide-slate-100 rounded-2xl border border-crimson-100 bg-crimson-50/30">
                                    {failed.map((it, idx) => (
                                        <li key={idx} className="flex items-center gap-3 p-3 text-sm">
                                            {it.thumb ? <img src={it.thumb} alt="" className="size-12 rounded-xl object-cover" /> : <div className="size-12 rounded-xl bg-slate-100" />}
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900">
                                                    {it.name} {it.voter && <span className="font-normal text-slate-500">— {it.voter.name} ({it.voter.class_name})</span>}
                                                </p>
                                                <p className="text-xs text-crimson-700">{it.reasons.join('; ')}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="table-wrap max-h-[480px] overflow-y-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Berkas</th>
                                        <th>Pemilih</th>
                                        <th>Status</th>
                                        <th>Kualitas</th>
                                        <th>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, idx) => (
                                        <tr key={idx}>
                                            <td className="font-mono text-xs">{it.name}</td>
                                            <td>{it.voter ? `${it.voter.name} (${it.voter.class_name})` : '—'}</td>
                                            <td>{STATUS[it.status]}</td>
                                            <td className="font-mono text-xs">{it.quality ?? '—'}</td>
                                            <td className="text-xs text-slate-600">{it.reasons?.join('; ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
