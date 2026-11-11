import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDateTime, RESULT_LABEL } from '../../lib/format';
import { IconActivity, IconUpload } from '../../components/Icons';
import { Badge, EmptyState, Pagination, Spinner } from '../../components/ui';

function Attempts() {
    const [f, setF] = useState({ method: '', result: '', device_id: '', suspicious: '', page: 1 });
    const devices = useQuery({ queryKey: ['devices'], queryFn: () => api.get('/panitia/devices').then((r) => r.data.data) });
    const list = useQuery({
        queryKey: ['attempts', f],
        queryFn: () => api.get('/panitia/logs/attempts', { params: f }).then((r) => r.data),
        placeholderData: keepPreviousData,
        refetchInterval: 15_000,
    });
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });
    const exportUrl = '/api/v1/panitia/logs/attempts/export?' + new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== 'page')).toString();

    return (
        <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                    <IconActivity className="size-5 text-brand-700" />
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Percobaan akses kiosk</h2>
                </div>
                <a className="btn-secondary btn-sm" href={exportUrl}>
                    <IconUpload className="size-4 rotate-180" />
                    Ekspor CSV
                </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select className="input" value={f.method} onChange={set('method')} aria-label="Metode">
                    <option value="">Semua metode</option>
                    <option value="face">Wajah</option>
                    <option value="fallback">Cadangan</option>
                </select>
                <select className="input" value={f.result} onChange={set('result')} aria-label="Hasil">
                    <option value="">Semua hasil</option>
                    {Object.entries(RESULT_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                            {v}
                        </option>
                    ))}
                </select>
                <select className="input" value={f.device_id} onChange={set('device_id')} aria-label="Perangkat">
                    <option value="">Semua tablet</option>
                    {devices.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>
                <select className="input" value={f.suspicious} onChange={set('suspicious')} aria-label="Mencurigakan">
                    <option value="">Semua kejadian</option>
                    <option value="1">Hanya mencurigakan</option>
                </select>
            </div>
            {list.isLoading ? (
                <Spinner label="Memuat log akses…" />
            ) : list.data?.data.length === 0 ? (
                <EmptyState>Belum ada catatan percobaan akses.</EmptyState>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Waktu (menit)</th>
                                <th>Tablet</th>
                                <th>Metode</th>
                                <th>Hasil</th>
                                <th>Pemilih</th>
                                <th>Skor</th>
                                <th>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.data?.data.map((a) => (
                                <tr key={a.id} className={a.is_suspicious ? 'bg-crimson-50/50' : ''}>
                                    <td className="whitespace-nowrap font-mono text-xs">{formatDateTime(a.created_at)}</td>
                                    <td className="font-medium">{a.device || '—'}</td>
                                    <td>{a.method === 'face' ? <Badge color="blue">Wajah</Badge> : <Badge color="gray">Cadangan</Badge>}</td>
                                    <td>
                                        <Badge color={a.result === 'matched' ? 'green' : a.is_suspicious ? 'red' : 'yellow'}>{RESULT_LABEL[a.result] || a.result}</Badge>
                                    </td>
                                    <td>{a.voter ? `${a.voter.name} (${a.voter.class_name})` : '—'}</td>
                                    <td className="font-mono text-xs tabular-nums">{a.score_top != null ? `${a.score_top} / Δ${a.score_margin}` : '—'}</td>
                                    <td className="text-xs text-slate-600">{a.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination meta={list.data?.meta} onPage={(page) => setF({ ...f, page })} />
        </section>
    );
}

function Activity() {
    const [page, setPage] = useState(1);
    const list = useQuery({ queryKey: ['activity', page], queryFn: () => api.get('/panitia/logs/activity', { params: { page } }).then((r) => r.data), placeholderData: keepPreviousData });
    return (
        <section className="card space-y-4">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Aktivitas panitia</h2>
            {list.isLoading ? (
                <Spinner label="Memuat aktivitas…" />
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Waktu</th>
                                <th>Pengguna</th>
                                <th>Aksi</th>
                                <th>Objek</th>
                                <th>Rincian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.data?.data.map((l) => (
                                <tr key={l.id}>
                                    <td className="whitespace-nowrap font-mono text-xs">{formatDateTime(l.created_at, { second: '2-digit' })}</td>
                                    <td className="font-medium">{l.user || 'sistem'}</td>
                                    <td className="font-mono text-xs text-brand-700">{l.action}</td>
                                    <td className="text-xs">{l.subject || '—'}</td>
                                    <td className="max-w-xs truncate font-mono text-xs text-slate-500" title={JSON.stringify(l.details)}>
                                        {l.details ? JSON.stringify(l.details) : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination meta={list.data ? { current_page: list.data.current_page, last_page: list.data.last_page, total: list.data.total } : null} onPage={setPage} />
        </section>
    );
}

export default function Log() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Log Audit &amp; Aktivitas</h1>
                <p className="mt-0.5 text-sm text-slate-500">Riwayat check-in tablet, deteksi kejadian mencurigakan, dan aksi administrasi panitia.</p>
            </div>
            <Attempts />
            <Activity />
        </div>
    );
}
