import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { number, STATUS_LABEL } from '../../lib/format';
import { switchSession, useSessions } from '../../components/SessionSwitcher';
import { Alert, Badge, EmptyState, Field, Spinner, toast } from '../../components/ui';
import { IconCopy, IconExternal, IconPlus, IconSchool } from '../../components/Icons';

const year = new Date().getFullYear();
const statusColor = (s) => (s === 'open' ? 'green' : s === 'published' ? 'blue' : s === 'closed' ? 'red' : 'gray');

function CreateSession() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const [form, setForm] = useState({ school_name: '', name: `Pemilihan Ketua OSIS ${year}/${year + 1}` });
    const [error, setError] = useState(null);

    const create = useMutation({
        mutationFn: () => api.post('/panitia/election', form),
        onSuccess: ({ data }) => {
            toast.success(`Sesi ${data.data.school_name} dibuat dan sedang dipilih.`);
            switchSession(qc, data.data.id);
            navigate('/panitia/jadwal');
        },
        onError: (e) => setError(errorMessage(e)),
    });

    return (
        <section className="card space-y-4">
            <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <IconPlus className="size-5" />
                </span>
                <div>
                    <h2 className="font-bold text-slate-900">Buat sesi sekolah baru</h2>
                    <p className="text-sm text-slate-500">Satu sesi = satu pemilihan untuk satu sekolah. Pemilih, kandidat, tablet, dan hasil setiap sesi terpisah.</p>
                </div>
            </div>
            <form
                className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    create.mutate();
                }}
            >
                <Field label="Nama sekolah">
                    {(id) => <input id={id} className="input" value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} placeholder="SMAN 1 Ciruas" required />}
                </Field>
                <Field label="Nama pemilihan">
                    {(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
                </Field>
                <button className="btn-primary" disabled={create.isPending || !form.school_name.trim() || !form.name.trim()}>
                    {create.isPending ? 'Membuat…' : 'Buat sesi'}
                </button>
            </form>
            {error && <Alert type="danger">{error}</Alert>}
        </section>
    );
}

export default function Sesi() {
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { data, isLoading } = useSessions();

    const copy = (path) =>
        navigator.clipboard?.writeText(window.location.origin + path).then(
            () => toast.success('Tautan hasil publik disalin.'),
            () => toast.error('Gagal menyalin; salin manual.'),
        );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Sesi Sekolah</h1>
                <p className="mt-0.5 text-sm text-slate-500">Jalankan pemilihan OSIS beberapa sekolah sekaligus. Pilih sesi untuk mengelola pemilih, kandidat, tablet, dan jadwalnya.</p>
            </div>

            <CreateSession />

            {isLoading && (
                <div className="card flex justify-center py-10">
                    <Spinner label="Memuat sesi…" />
                </div>
            )}
            {data?.data.length === 0 && <EmptyState>Belum ada sesi. Buat sesi pertama di atas.</EmptyState>}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data?.data.map((s) => {
                    const active = s.id === data.current_id;
                    return (
                        <article key={s.id} className={`card flex min-w-0 flex-col gap-4 ${active ? 'ring-2 ring-brand-500' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                        <IconSchool className="size-5.5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="truncate text-lg font-extrabold text-slate-900">{s.school_name}</h2>
                                        <p className="truncate text-sm text-slate-500">{s.name}</p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    <Badge color={statusColor(s.status)} dot={s.status === 'open'}>
                                        {STATUS_LABEL[s.status]}
                                    </Badge>
                                    {s.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
                                </div>
                            </div>

                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <dt className="text-xs font-semibold text-slate-500">Pemilih</dt>
                                    <dd className="text-xl font-extrabold tabular-nums text-slate-900">{number(s.voters_count)}</dd>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <dt className="text-xs font-semibold text-slate-500">Suara masuk</dt>
                                    <dd className="text-xl font-extrabold tabular-nums text-slate-900">{number(s.votes_count)}</dd>
                                </div>
                            </dl>

                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                                <span className="shrink-0 font-semibold text-slate-500">Hasil publik</span>
                                <code className="min-w-0 flex-1 truncate text-slate-700">{s.public_url}</code>
                                <button type="button" className="btn-ghost btn-sm px-2" onClick={() => copy(s.public_url)} aria-label={`Salin tautan hasil ${s.school_name}`}>
                                    <IconCopy className="size-4" />
                                </button>
                                <a href={s.public_url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm px-2" aria-label={`Buka hasil ${s.school_name}`}>
                                    <IconExternal className="size-4" />
                                </a>
                            </div>
                            {s.status === 'draft' && <p className="-mt-2 text-xs text-slate-500">Halaman hasil publik baru tampil setelah sesi dibuka.</p>}

                            <div className="mt-auto flex gap-2">
                                {active ? (
                                    <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-800">Sedang dikelola</span>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn-primary flex-1"
                                        onClick={() => {
                                            switchSession(qc, s.id);
                                            navigate('/panitia');
                                        }}
                                    >
                                        Kelola sesi ini
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
