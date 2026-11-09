import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime, fromWibInput, STATUS_LABEL, toWibInput } from '../../lib/format';
import { useAuth } from '../../features/auth/useAuth';
import { Alert, Badge, Field, Spinner, toast, TypedConfirm } from '../../components/ui';
import { useElection } from './PanitiaLayout';

const TRANSITION = {
    open: { word: 'BUKA', label: 'Buka pemilihan', desc: 'Tablet akan mulai menerima pemilih (sesuai jam buka–tutup). Data kandidat tidak dapat diubah setelah dibuka.' },
    closed: { word: 'TUTUP', label: 'Tutup pemilihan', desc: 'Pemungutan suara dihentikan, sisa suara disegel ke ledger dan diverifikasi.' },
    published: { word: 'PUBLIKASI', label: 'Publikasikan hasil akhir', desc: 'Ledger diverifikasi; bila valid, hasil akhir & hash terakhir ditampilkan ke publik. Tidak dapat dibatalkan.' },
};

function CreateElection() {
    const qc = useQueryClient();
    const [name, setName] = useState('Pemilihan Ketua OSIS SMAN 1 Ciruas');
    const m = useMutation({
        mutationFn: () => api.post('/panitia/election', { name }),
        onSuccess: () => {
            toast.success('Pemilihan dibuat.');
            qc.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
    });
    return (
        <section className="card space-y-3">
            <h2 className="font-bold">Buat pemilihan baru</h2>
            <Field label="Nama pemilihan">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <button className="btn-primary" onClick={() => m.mutate()} disabled={m.isPending || !name}>
                Buat
            </button>
        </section>
    );
}

function SettingsForm({ election }) {
    const qc = useQueryClient();
    const { isAdmin } = useAuth();
    const [form, setForm] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        setForm({
            name: election.name,
            opens_at: toWibInput(election.opens_at),
            closes_at: toWibInput(election.closes_at),
            settings: { ...election.settings },
        });
    }, [election]);

    const save = useMutation({
        mutationFn: () => {
            const payload = { name: form.name, opens_at: fromWibInput(form.opens_at), closes_at: fromWibInput(form.closes_at) };
            if (election.status === 'draft' || isAdmin) payload.settings = form.settings;
            return api.put('/panitia/election', payload);
        },
        onSuccess: () => {
            toast.success('Pengaturan disimpan.');
            setError(null);
            qc.invalidateQueries({ queryKey: ['election'] });
        },
        onError: (e) => setError(errorMessage(e)),
    });

    if (!form) return null;
    const s = form.settings;
    const setS = (k, cast = Number) => (e) => setForm({ ...form, settings: { ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : cast(e.target.value) } });
    const locked = election.status === 'published';
    const settingsLocked = locked || (election.status !== 'draft' && !isAdmin);

    return (
        <section className="card space-y-5">
            <h2 className="font-bold">Jadwal & pengaturan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <Field label="Nama pemilihan">{(id) => <input id={id} className="input" value={form.name} disabled={locked} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
                </div>
                <Field label="Jam buka (WIB)" hint={formatDateTime(election.opens_at)}>
                    {(id) => <input id={id} type="datetime-local" className="input" value={form.opens_at} disabled={locked} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} />}
                </Field>
                <Field label="Jam tutup (WIB)" hint="Pemilihan ditutup otomatis saat jam ini (cron schedule:run).">
                    {(id) => <input id={id} type="datetime-local" className="input" value={form.closes_at} disabled={locked} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />}
                </Field>
            </div>

            <fieldset className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3" disabled={settingsLocked}>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Aturan pengenalan wajah {settingsLocked && '(terkunci)'}</legend>
                <Field label="Ambang kecocokan (cosine)" hint="Kalibrasi dari halaman Uji Wajah.">
                    {(id) => <input id={id} type="number" step="0.01" min="0.2" max="0.95" className="input" value={s.match_threshold} onChange={setS('match_threshold')} />}
                </Field>
                <Field label="Margin minimal (s1 − s2)">
                    {(id) => <input id={id} type="number" step="0.01" min="0" max="0.5" className="input" value={s.match_margin} onChange={setS('match_margin')} />}
                </Field>
                <Field label="Ambang wajah ganda (pendaftaran)">
                    {(id) => <input id={id} type="number" step="0.01" min="0.3" max="0.99" className="input" value={s.duplicate_threshold} onChange={setS('duplicate_threshold')} />}
                </Field>
                <Field label="Batas percobaan cadangan">
                    {(id) => <input id={id} type="number" min="1" max="10" className="input" value={s.max_fallback_attempts} onChange={setS('max_fallback_attempts')} />}
                </Field>
                <Field label="Waktu konfirmasi nama (detik)">
                    {(id) => <input id={id} type="number" min="30" max="600" className="input" value={s.ticket_identified_ttl} onChange={setS('ticket_identified_ttl')} />}
                </Field>
                <Field label="Waktu memilih (detik)">
                    {(id) => <input id={id} type="number" min="60" max="900" className="input" value={s.ticket_vote_ttl} onChange={setS('ticket_vote_ttl')} />}
                </Field>
                <Field label="Ukuran batch segel ledger" hint="Hasil langsung naik per kelompok ini (kerahasiaan).">
                    {(id) => <input id={id} type="number" min="1" max="100" className="input" value={s.seal_batch_size} onChange={setS('seal_batch_size')} />}
                </Field>
                <label className="flex items-center gap-2 self-end pb-3">
                    <input type="checkbox" className="size-5" checked={!!s.require_liveness} onChange={setS('require_liveness')} />
                    Wajibkan liveness (kedip/toleh)
                </label>
            </fieldset>

            {error && <Alert type="danger">{error}</Alert>}
            {!locked && (
                <div className="flex justify-end">
                    <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? 'Menyimpan…' : 'Simpan'}
                    </button>
                </div>
            )}
        </section>
    );
}

function StatusPanel({ election }) {
    const qc = useQueryClient();
    const [target, setTarget] = useState(null);
    const [error, setError] = useState(null);
    const verify = useQuery({ queryKey: ['verify'], queryFn: () => api.get('/panitia/election/verify').then((r) => r.data), enabled: false });

    const transition = useMutation({
        mutationFn: (confirm) => api.post('/panitia/election/status', { status: target, confirm }),
        onSuccess: ({ data }) => {
            toast.success(`Status: ${STATUS_LABEL[data.data.status]}`);
            setTarget(null);
            setError(null);
            qc.invalidateQueries();
        },
        onError: (e) => setError(errorMessage(e)),
    });

    async function printReport() {
        const { data } = await api.get('/panitia/election/report');
        const w = window.open('', '_blank');
        if (!w) return toast.error('Izinkan pop-up untuk mencetak laporan.');
        const r = data.results;
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
        const rows = r.candidates.map((c) => `<tr><td>${c.number}</td><td>${esc(c.name)}</td><td style="text-align:right">${c.votes}</td><td style="text-align:right">${c.percent}%</td></tr>`).join('');
        w.document.write(`<html><head><title>Laporan ${esc(r.election.name)}</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}code{word-break:break-all}</style></head><body>
<h2>Laporan Hasil — ${esc(r.election.name)}</h2><p>Status: ${STATUS_LABEL[r.election.status]} · Dibuat: ${formatDateTime(data.generated_at)}</p>
<table><tr><th>No</th><th>Kandidat</th><th>Suara</th><th>%</th></tr>${rows}</table>
<p>Partisipasi: siswa ${r.participation.students.voted}/${r.participation.students.total}, guru ${r.participation.teachers.voted}/${r.participation.teachers.total}, total ${r.participation.all.voted}/${r.participation.all.total}.</p>
<p>Verifikasi ledger: <b>${data.verification.ok ? 'VALID' : 'TIDAK VALID'}</b> — ${data.verification.sealed} suara tersegel, ${data.verification.pending} menunggu.</p>
<p>Hash terakhir: <code>${data.verification.head ?? '-'}</code></p>
<br><br><table style="border:none"><tr><td style="border:none;text-align:center">Ketua Panitia<br><br><br><br>(..................)</td><td style="border:none;text-align:center">Kepala Sekolah<br><br><br><br>(..................)</td></tr></table>
<script>window.print()</script></body></html>`);
        w.document.close();
    }

    const allowed = election.allowed_transitions || [];

    return (
        <section className="card space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">Status pemilihan</h2>
                <Badge color={election.status === 'open' ? 'green' : 'gray'}>{STATUS_LABEL[election.status]}</Badge>
                {election.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
            </div>
            {election.closed_reason && election.status === 'open' && <Alert type="warning">{election.closed_reason}</Alert>}
            <div className="flex flex-wrap gap-2">
                {allowed.map((to) => (
                    <button key={to} className={to === 'closed' ? 'btn-danger' : 'btn-primary'} onClick={() => setTarget(to)}>
                        {to === 'open' && election.status === 'closed' ? 'Buka kembali (admin)' : TRANSITION[to].label}
                    </button>
                ))}
                <button className="btn-secondary" onClick={() => verify.refetch()}>
                    Verifikasi ledger
                </button>
                <button className="btn-secondary" onClick={printReport}>
                    Cetak laporan
                </button>
            </div>
            {verify.data && (
                <Alert type={verify.data.ok ? 'success' : 'danger'} title={verify.data.ok ? 'Ledger valid' : 'Ledger TIDAK valid'}>
                    {verify.data.sealed} tersegel · {verify.data.pending} menunggu · {verify.data.votes} suara · {verify.data.turnout} penanda sudah memilih
                    {verify.data.head && <code className="mt-1 block text-xs break-all">{verify.data.head}</code>}
                    {verify.data.errors?.map((e) => (
                        <div key={e}>• {e}</div>
                    ))}
                </Alert>
            )}
            {election.ledger_head_hash && election.status === 'published' && (
                <p className="text-sm text-slate-600">
                    Hash terakhir dipublikasikan: <code className="break-all">{election.ledger_head_hash}</code>
                </p>
            )}
            {target && (
                <TypedConfirm
                    open
                    onClose={() => {
                        setTarget(null);
                        setError(null);
                    }}
                    onConfirm={(v) => transition.mutate(v)}
                    title={TRANSITION[target].label}
                    description={TRANSITION[target].desc}
                    word={TRANSITION[target].word}
                    danger={target === 'closed'}
                    busy={transition.isPending}
                    error={error}
                />
            )}
        </section>
    );
}

function SimulationPanel({ election }) {
    const qc = useQueryClient();
    const [voters, setVoters] = useState(30);
    const [purgeOpen, setPurgeOpen] = useState(false);
    const create = useMutation({
        mutationFn: () => api.post('/panitia/simulation', { voters }),
        onSuccess: ({ data }) => {
            toast.success(data.message);
            qc.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
    });
    const purge = useMutation({
        mutationFn: (confirm) => api.post('/panitia/simulation/purge', { confirm }),
        onSuccess: () => {
            toast.success('Data simulasi dihapus.');
            setPurgeOpen(false);
            qc.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
    });
    return (
        <section className="card space-y-3">
            <h2 className="font-bold">Mode simulasi (gladi bersih)</h2>
            <p className="text-sm text-slate-600">
                Membuat pemilihan percobaan + pemilih palsu (NISN 99xxxxxxxx, tgl lahir 2008-01-01) yang terpisah dari data nyata. Untuk uji wajah, daftarkan foto relawan ke pemilih simulasi.
                Hapus bersih sebelum hari-H.
            </p>
            <div className="flex flex-wrap items-end gap-2">
                <Field label="Jumlah pemilih palsu">{(id) => <input id={id} type="number" min="1" max="2000" className="input w-36" value={voters} onChange={(e) => setVoters(Number(e.target.value))} />}</Field>
                <button className="btn-secondary" onClick={() => create.mutate()} disabled={create.isPending}>
                    Buat simulasi
                </button>
                <button className="btn-danger" onClick={() => setPurgeOpen(true)}>
                    Hapus semua data simulasi
                </button>
            </div>
            {election?.is_simulation && <Alert type="warning">Pemilihan aktif saat ini adalah SIMULASI.</Alert>}
            <TypedConfirm open={purgeOpen} onClose={() => setPurgeOpen(false)} onConfirm={(v) => purge.mutate(v)} title="Hapus data simulasi" word="HAPUS SIMULASI" danger busy={purge.isPending} />
        </section>
    );
}

function RetentionPanel() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const m = useMutation({
        mutationFn: (confirm) => api.post('/panitia/face-templates/purge', { confirm }),
        onSuccess: ({ data }) => {
            toast.success(data.message);
            setOpen(false);
            qc.invalidateQueries();
        },
        onError: (e) => toast.error(errorMessage(e)),
    });
    return (
        <section className="card space-y-3 border-red-200">
            <h2 className="font-bold text-red-800">Retensi data wajah</h2>
            <p className="text-sm text-slate-600">Setelah hasil final, hapus semua template wajah sesuai kebijakan retensi (§8). Tindakan ini permanen dan tercatat di log.</p>
            <button className="btn-danger" onClick={() => setOpen(true)}>
                Hapus semua template wajah
            </button>
            <TypedConfirm open={open} onClose={() => setOpen(false)} onConfirm={(v) => m.mutate(v)} title="Hapus semua template wajah" word="HAPUS SEMUA WAJAH" danger busy={m.isPending} />
        </section>
    );
}

export default function Jadwal() {
    const { data: election, isLoading } = useElection();
    const { isAdmin } = useAuth();

    if (isLoading) return <Spinner label="Memuat…" />;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Jadwal &amp; Status</h1>
            {!election || (election.status === 'published' && !election.is_simulation) ? <CreateElection /> : null}
            {election && (
                <>
                    <StatusPanel election={election} />
                    <SettingsForm election={election} />
                </>
            )}
            {isAdmin && <SimulationPanel election={election} />}
            {isAdmin && <RetentionPanel />}
        </div>
    );
}
