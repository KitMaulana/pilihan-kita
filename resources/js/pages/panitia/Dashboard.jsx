import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDateTime, formatTime, number, percent } from '../../lib/format';
import {
    IconAlertTriangle,
    IconCalendarClock,
    IconChartBar,
    IconDeviceTablet,
    IconFaceScan,
    IconLock,
    IconUserCheck,
    IconVoteBox,
} from '../../components/Icons';
import { Alert, Badge, ProgressBar, Spinner, Stat } from '../../components/ui';

const BAR_COLORS = [
    'bg-gradient-to-r from-brand-700 to-brand-500',
    'bg-gradient-to-r from-crimson-600 to-crimson-500',
    'bg-gradient-to-r from-emerald-600 to-emerald-500',
    'bg-gradient-to-r from-amber-500 to-amber-400',
    'bg-gradient-to-r from-violet-600 to-indigo-500',
];

export default function Dashboard() {
    const { data, isLoading, dataUpdatedAt } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => api.get('/panitia/dashboard').then((r) => r.data),
        refetchInterval: 10_000,
    });

    if (isLoading) {
        return (
            <div className="card flex justify-center py-12">
                <Spinner label="Memuat dasbor…" />
            </div>
        );
    }
    if (!data) return null;

    const r = data.results;
    const part = r?.participation;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Dasbor Kontrol</h1>
                    <p className="mt-0.5 text-sm text-slate-500">Pantau partisipasi, perolehan suara langsung, dan status tablet di lapangan.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs">
                    <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                    Diperbarui {formatTime(new Date(dataUpdatedAt).toISOString())} WIB · tiap 10 dtk
                </div>
            </div>

            {!data.election && (
                <Alert type="info" title="Belum ada pemilihan">
                    Buat pemilihan terlebih dahulu di menu{' '}
                    <Link to="/panitia/jadwal" className="font-bold underline">
                        Jadwal &amp; Status
                    </Link>
                    .
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
                <Stat
                    label="Sudah check-in"
                    value={part ? `${number(part.all.voted)} / ${number(part.all.total)}` : '—'}
                    sub={part ? `${percent(part.all.voted, part.all.total)}% partisipasi · ${number(r.votes_counted)} suara masuk` : null}
                    tone="good"
                    icon={<IconUserCheck className="size-5" />}
                />
                <Stat
                    label="Terdaftar wajah"
                    value={`${number(data.voters.with_face)} / ${number(data.voters.total)}`}
                    sub={`${data.voters.face_percent}% (target ≥ 98%)`}
                    tone={data.voters.face_percent >= 98 ? 'good' : 'warn'}
                    icon={<IconFaceScan className="size-5" />}
                />
                <Stat
                    label="Pemilih terkunci"
                    value={number(data.voters.locked)}
                    tone={data.voters.locked ? 'warn' : 'default'}
                    sub="Buka kunci di menu Pemilih"
                    icon={<IconLock className="size-5" />}
                />
                <Stat
                    label="Wajah ganda ditandai"
                    value={number(data.voters.duplicates_flagged)}
                    tone={data.voters.duplicates_flagged ? 'bad' : 'default'}
                    sub="Periksa di menu Pemilih"
                    icon={<IconAlertTriangle className="size-5" />}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="card lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <IconChartBar className="size-5 text-brand-700" />
                            <h2 className="font-extrabold tracking-tight text-slate-900">Perolehan Suara Langsung</h2>
                        </div>
                        <span className="text-xs font-medium text-slate-500">Sama dengan tampilan publik</span>
                    </div>

                    {r ? (
                        <ul className="space-y-4">
                            {r.candidates.map((c, idx) => (
                                <li key={c.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                                        <span className="font-bold text-slate-900">
                                            <span className="mr-1.5 text-brand-700">No. {c.number}</span>
                                            {c.name}
                                        </span>
                                        <span className="font-mono font-bold tabular-nums text-slate-800">
                                            {number(c.votes)} <span className="text-brand-700">({c.percent}%)</span>
                                        </span>
                                    </div>
                                    <div className="mt-2">
                                        <ProgressBar value={c.percent} color={BAR_COLORS[idx % BAR_COLORS.length]} label={c.name} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-500">—</p>
                    )}

                    {r && <p className="mt-4 text-xs font-medium text-slate-500">{number(r.votes_counted)} suara masuk · dihitung langsung (real-time)</p>}

                    {data.booth && (
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-brand-200/80 bg-gradient-to-r from-brand-50 to-white p-4">
                            <div className="flex items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                                    <IconVoteBox className="size-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-brand-900">Antre di bilik suara</p>
                                    <p className="text-xs text-slate-600">Sudah check-in, belum memilih. Hak masuk tidak hangus oleh waktu.</p>
                                </div>
                            </div>
                            <p className="font-mono text-3xl font-black text-brand-800 tabular-nums">{number(data.booth.waiting)}</p>
                        </div>
                    )}

                    {part && (
                        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                    <span>Partisipasi Siswa</span>
                                    <span className="font-mono tabular-nums">
                                        {number(part.students.voted)} / {number(part.students.total)}
                                    </span>
                                </div>
                                <ProgressBar value={percent(part.students.voted, part.students.total)} color="bg-gradient-to-r from-emerald-600 to-emerald-500" label="Partisipasi siswa" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                    <span>Partisipasi Guru &amp; Staf</span>
                                    <span className="font-mono tabular-nums">
                                        {number(part.teachers.voted)} / {number(part.teachers.total)}
                                    </span>
                                </div>
                                <ProgressBar value={percent(part.teachers.voted, part.teachers.total)} color="bg-gradient-to-r from-crimson-600 to-crimson-500" label="Partisipasi guru" />
                            </div>
                        </div>
                    )}
                </section>

                <section className="card flex flex-col">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <IconDeviceTablet className="size-5 text-brand-700" />
                            <h2 className="font-extrabold tracking-tight text-slate-900">Status Tablet</h2>
                        </div>
                        <Link to="/panitia/perangkat" className="text-xs font-bold text-brand-700 hover:underline">
                            Kelola →
                        </Link>
                    </div>

                    {data.devices.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada tablet terdaftar.</p>
                    ) : (
                        <ul className="space-y-2.5">
                            {data.devices.map((d) => (
                                <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-slate-900">{d.name}</p>
                                        <p className="text-xs text-slate-500">{d.role === 'booth' ? 'Bilik suara' : 'Meja check-in'}</p>
                                    </div>
                                    {!d.is_active ? (
                                        <Badge color="gray">Dicabut</Badge>
                                    ) : d.online ? (
                                        <Badge color="green" dot>
                                            Aktif
                                        </Badge>
                                    ) : (
                                        <Badge color="yellow">Tidak terlihat</Badge>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {data.election && (
                        <div className="mt-auto border-t border-slate-100 pt-4 text-xs text-slate-600 sm:text-sm">
                            <div className="mb-2 flex items-center gap-1.5 font-bold text-slate-800">
                                <IconCalendarClock className="size-4 text-brand-700" />
                                Jadwal Aktif
                            </div>
                            <p>
                                <span className="text-slate-500">Buka:</span> <span className="font-medium">{formatDateTime(data.election.opens_at)}</span>
                            </p>
                            <p className="mt-0.5">
                                <span className="text-slate-500">Tutup:</span> <span className="font-medium">{formatDateTime(data.election.closes_at)}</span>
                            </p>
                            <p className="mt-2">
                                Status:{' '}
                                {data.election.is_voting_open ? (
                                    <Badge color="green" dot>
                                        Sedang berlangsung
                                    </Badge>
                                ) : (
                                    <Badge>Tidak berlangsung</Badge>
                                )}
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
