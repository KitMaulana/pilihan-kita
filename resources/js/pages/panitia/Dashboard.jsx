import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDateTime, formatTime, number, percent } from '../../lib/format';
import { Alert, Badge, ProgressBar, Spinner, Stat } from '../../components/ui';

export default function Dashboard() {
    const { data, isLoading, dataUpdatedAt } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => api.get('/panitia/dashboard').then((r) => r.data),
        refetchInterval: 10_000,
    });

    if (isLoading) return <Spinner label="Memuat dasbor…" />;
    if (!data) return null;

    const r = data.results;
    const part = r?.participation;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Dasbor</h1>
                <p className="text-xs text-slate-500">Diperbarui {formatTime(new Date(dataUpdatedAt).toISOString())} WIB · otomatis tiap 10 detik</p>
            </div>

            {!data.election && (
                <Alert type="info" title="Belum ada pemilihan">
                    Buat pemilihan di menu <Link to="/panitia/jadwal" className="underline">Jadwal &amp; Status</Link>.
                </Alert>
            )}

            {data.anomalies?.length > 0 && (
                <section className="space-y-2" aria-label="Indikator anomali">
                    {data.anomalies.map((a, i) => (
                        <Alert key={i} type={a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : 'info'}>
                            {a.message}
                        </Alert>
                    ))}
                </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Sudah check-in" value={part ? `${number(part.all.voted)} / ${number(part.all.total)}` : '—'} sub={part ? `${percent(part.all.voted, part.all.total)}% partisipasi · ${number(r.votes_counted)} suara masuk` : null} tone="good" />
                <Stat
                    label="Terdaftar wajah"
                    value={`${number(data.voters.with_face)} / ${number(data.voters.total)}`}
                    sub={`${data.voters.face_percent}% (target ≥ 98%)`}
                    tone={data.voters.face_percent >= 98 ? 'good' : 'warn'}
                />
                <Stat label="Pemilih terkunci" value={number(data.voters.locked)} tone={data.voters.locked ? 'warn' : 'default'} sub="Buka kunci di menu Pemilih" />
                <Stat label="Wajah ganda ditandai" value={number(data.voters.duplicates_flagged)} tone={data.voters.duplicates_flagged ? 'warn' : 'default'} sub="Periksa di menu Pemilih" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="card lg:col-span-2">
                    <h2 className="mb-4 font-bold text-slate-900">Perolehan (sama dengan tampilan publik)</h2>
                    {r ? (
                        <ul className="space-y-4">
                            {r.candidates.map((c) => (
                                <li key={c.id}>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">
                                            No. {c.number} — {c.name}
                                        </span>
                                        <span className="tabular-nums">
                                            {number(c.votes)} ({c.percent}%)
                                        </span>
                                    </div>
                                    <div className="mt-1">
                                        <ProgressBar value={c.percent} label={c.name} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-500">—</p>
                    )}
                    {r && <p className="mt-4 text-xs text-slate-500">{number(r.votes_counted)} suara masuk · dihitung langsung (real-time)</p>}
                    {data.booth && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-brand-50 p-3">
                                <p className="text-sm text-brand-800">Antre di bilik suara</p>
                                <p className="text-2xl font-bold text-brand-900 tabular-nums">{number(data.booth.waiting)}</p>
                                <p className="text-xs text-slate-500">Sudah check-in, belum memilih</p>
                            </div>
                            <div className={`rounded-xl p-3 ${data.booth.expired ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                <p className="text-sm text-slate-700">Hak masuk bilik hangus</p>
                                <p className="text-2xl font-bold tabular-nums">{number(data.booth.expired)}</p>
                                <p className="text-xs text-slate-500">Check-in tetapi tidak memilih dalam {Math.round(data.booth.ttl / 60)} menit</p>
                            </div>
                        </div>
                    )}
                    {part && (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-sm text-slate-600">
                                    Siswa {number(part.students.voted)}/{number(part.students.total)}
                                </p>
                                <ProgressBar value={percent(part.students.voted, part.students.total)} color="bg-emerald-600" label="Partisipasi siswa" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">
                                    Guru {number(part.teachers.voted)}/{number(part.teachers.total)}
                                </p>
                                <ProgressBar value={percent(part.teachers.voted, part.teachers.total)} color="bg-emerald-600" label="Partisipasi guru" />
                            </div>
                        </div>
                    )}
                </section>

                <section className="card">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-bold text-slate-900">Tablet</h2>
                        <Link to="/panitia/perangkat" className="text-sm text-brand-700 underline">
                            Kelola
                        </Link>
                    </div>
                    {data.devices.length === 0 && <p className="text-sm text-slate-500">Belum ada tablet terdaftar.</p>}
                    <ul className="space-y-2">
                        {data.devices.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">
                                    {d.name} <span className="text-xs text-slate-500">· {d.role === 'booth' ? 'bilik' : 'check-in'}</span>
                                </span>
                                {!d.is_active ? <Badge color="gray">Dicabut</Badge> : d.online ? <Badge color="green">Aktif</Badge> : <Badge color="yellow">Tidak terlihat</Badge>}
                            </li>
                        ))}
                    </ul>
                    {data.election && (
                        <div className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-600">
                            <p>Buka: {formatDateTime(data.election.opens_at)}</p>
                            <p>Tutup: {formatDateTime(data.election.closes_at)}</p>
                            <p className="mt-1">Voting {data.election.is_voting_open ? <Badge color="green">sedang berlangsung</Badge> : <Badge>tidak berlangsung</Badge>}</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
