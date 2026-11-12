import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDateTime, formatTime, number, percent, STATUS_LABEL } from '../../lib/format';
import { Alert, Badge, Spinner, toast } from '../../components/ui';
import { IconArrowRight, IconAward, IconCalendarClock, IconChartBar, IconCheckCircle, IconCopy, IconPrinter, IconSchool, IconShieldCheck, IconUsers } from '../../components/Icons';
import PublicShell from './PublicShell';

// Warna batang dibedakan + diberi label angka (tidak bergantung warna saja).
const BAR_COLORS = [
    'bg-gradient-to-r from-brand-700 to-brand-500',
    'bg-gradient-to-r from-crimson-600 to-crimson-500',
    'bg-gradient-to-r from-emerald-600 to-emerald-500',
    'bg-gradient-to-r from-amber-500 to-amber-400',
    'bg-gradient-to-r from-violet-600 to-indigo-500',
];

/** Daftar sekolah yang pemilihannya sudah dibuka / selesai. */
export function usePublicSessions() {
    return useQuery({
        queryKey: ['public-sessions'],
        queryFn: () => api.get('/public/sessions').then((r) => r.data.data),
        refetchInterval: 30_000,
        staleTime: 15_000,
    });
}

export function useResults(slug) {
    return useQuery({
        queryKey: ['public-results', slug],
        enabled: !!slug,
        retry: (n, e) => e?.response?.status !== 404 && n < 3,
        queryFn: () => api.get('/public/results', { params: { session: slug } }).then((r) => r.data),
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
        staleTime: 4000,
    });
}

function Participation({ label, data, barColor = 'bg-gradient-to-r from-emerald-600 to-emerald-500' }) {
    const p = percent(data.voted, data.total);
    return (
        <div>
            <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-slate-700">{label}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
                    {number(data.voted)} / {number(data.total)} <span className="text-slate-900">({p}%)</span>
                </span>
            </div>
            <div
                className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70"
                role="progressbar"
                aria-valuenow={p}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Partisipasi ${label}`}
            >
                <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${p}%` }} />
            </div>
        </div>
    );
}

const STATUS_TONE = { open: 'green', closed: 'red', published: 'blue' };

/** Pilihan sekolah (bila lebih dari satu sesi berjalan). */
function SchoolPicker({ sessions }) {
    return (
        <div className="space-y-5">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 p-6 text-white shadow-lg sm:p-7">
                <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
                <div className="relative">
                    <p className="text-xs font-semibold tracking-wider text-brand-200 uppercase">Hitung Langsung</p>
                    <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Pilih sekolah</h1>
                    <p className="mt-1 text-sm text-brand-100 sm:text-base">Hasil setiap sekolah dihitung terpisah dan diperbarui otomatis.</p>
                </div>
            </section>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((s) => (
                    <li key={s.slug}>
                        <Link to={`/hasil/${s.slug}`} className="card group flex h-full flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-lg">
                            <div className="flex items-start justify-between gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                    <IconSchool className="size-5.5" />
                                </span>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge color={STATUS_TONE[s.status] || 'gray'} dot={s.is_voting_open}>
                                        {s.is_voting_open ? 'Sedang berlangsung' : STATUS_LABEL[s.status]}
                                    </Badge>
                                    {s.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-extrabold text-slate-900">{s.school_name}</h2>
                                <p className="text-sm text-slate-500">{s.name}</p>
                            </div>
                            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 group-hover:gap-2.5">
                                Lihat hasil <IconArrowRight className="size-4 transition-all" />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Pindah sekolah langsung dari halaman hasil. */
function SchoolSwitch({ sessions, slug }) {
    const navigate = useNavigate();
    if (sessions.length < 2) return null;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="school-switch" className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <IconSchool className="size-4" /> Sekolah
            </label>
            <select id="school-switch" className="input min-h-11 w-auto max-w-full py-2" value={slug} onChange={(e) => navigate(`/hasil/${e.target.value}`)}>
                {sessions.map((s) => (
                    <option key={s.slug} value={s.slug}>
                        {s.school_name}
                        {s.is_simulation ? ' (simulasi)' : ''}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default function HasilLangsung() {
    const { slug } = useParams();
    const sessions = usePublicSessions();

    if (!slug) {
        if (sessions.isLoading) {
            return (
                <PublicShell wide>
                    <div className="card flex justify-center py-12">
                        <Spinner label="Memuat daftar sekolah…" />
                    </div>
                </PublicShell>
            );
        }
        const list = sessions.data || [];
        if (list.length === 1) return <Navigate to={`/hasil/${list[0].slug}`} replace />;
        return (
            <PublicShell wide>
                {sessions.isError && <Alert type="danger">Gagal memuat daftar sekolah. Mencoba lagi otomatis…</Alert>}
                {list.length === 0 && !sessions.isError ? <Alert>Belum ada pemilihan yang dibuka.</Alert> : <SchoolPicker sessions={list} />}
            </PublicShell>
        );
    }

    return <SchoolResults slug={slug} sessions={sessions.data || []} />;
}

function SchoolResults({ slug, sessions }) {
    const { data, isLoading, isError, error, dataUpdatedAt } = useResults(slug);
    const [copied, setCopied] = useState(false);

    const topVotes = data?.candidates?.reduce((m, c) => Math.max(m, c.votes || 0), 0) || 0;
    const totalPct = data?.participation ? percent(data.participation.all.voted, data.participation.all.total) : 0;

    function copyHash(hash) {
        navigator.clipboard?.writeText(hash).then(
            () => {
                setCopied(true);
                toast.success('Hash ledger disalin.');
                setTimeout(() => setCopied(false), 2000);
            },
            () => toast.error('Gagal menyalin; salin manual.'),
        );
    }

    return (
        <PublicShell wide>
            {isLoading && (
                <div className="card flex justify-center py-12">
                    <Spinner label="Memuat hitung langsung…" />
                </div>
            )}
            <div className="mb-4">
                <SchoolSwitch sessions={sessions} slug={slug} />
            </div>
            {isError && error?.response?.status === 404 && (
                <Alert type="warning" title="Sekolah tidak ditemukan">
                    Tautan ini tidak dikenal atau pemilihannya belum dibuka.{' '}
                    <Link to="/hasil" className="font-bold underline">
                        Lihat daftar sekolah
                    </Link>
                </Alert>
            )}
            {isError && error?.response?.status !== 404 && <Alert type="danger">Gagal memuat hasil. Mencoba lagi otomatis…</Alert>}
            {data && !data.election && <Alert>Belum ada pemilihan yang disiapkan.</Alert>}

            {data?.election && (
                <div className="space-y-6">
                    {/* Header Banner */}
                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 p-6 text-white shadow-lg sm:p-7">
                        <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
                        <div className="relative flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge color={data.election.status === 'open' ? 'green' : data.is_final ? 'blue' : 'gray'} dot={data.election.status === 'open'}>
                                        {STATUS_LABEL[data.election.status]}
                                    </Badge>
                                    {data.election.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
                                    <span className="text-xs font-semibold text-brand-200">
                                        {data.is_final ? 'Rekap Resmi Final' : 'Real Count · Pembaruan 5 Detik'}
                                    </span>
                                </div>
                                <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                                    {data.is_final ? 'Hasil Akhir Pemilihan' : 'Hitung Langsung'}
                                </h1>
                                <p className="mt-0.5 text-base font-bold text-white sm:text-lg">{data.election.school_name}</p>
                                {data.is_final && (
                                    <a
                                        href={`/api/v1/public/results/pdf?session=${encodeURIComponent(data.election.slug)}`}
                                        download
                                        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/25"
                                    >
                                        <IconPrinter className="size-4" />
                                        Unduh Hasil Akhir (PDF A4)
                                    </a>
                                )}
                                <p className="text-sm text-brand-100">{data.election.name}</p>
                            </div>

                            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-left backdrop-blur-md sm:text-right">
                                <p className="text-[11px] font-semibold tracking-wider text-brand-200 uppercase">Terakhir diperbarui</p>
                                <p className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums" aria-live="polite">
                                    {formatTime(data.generated_at || new Date(dataUpdatedAt).toISOString())} WIB
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* KPI Summary Strip */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <div className="card p-4">
                            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">Suara Terhitung</p>
                            <p className="mt-1.5 text-2xl font-extrabold text-brand-900 tabular-nums sm:text-3xl">{number(data.votes_counted)}</p>
                            <p className="mt-1 text-xs text-slate-500">Real count masuk kotak</p>
                        </div>
                        <div className="card p-4">
                            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">Partisipasi</p>
                            <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 tabular-nums sm:text-3xl">{totalPct}%</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {number(data.participation.all.voted)} dari {number(data.participation.all.total)} pemilih
                            </p>
                        </div>
                        <div className="card p-4">
                            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">Kandidat</p>
                            <p className="mt-1.5 text-2xl font-extrabold text-slate-900 tabular-nums sm:text-3xl">{number(data.candidates.length)}</p>
                            <p className="mt-1 text-xs text-slate-500">{data.ballot_mode === 'separate' ? 'Calon ketua & wakil' : 'Pasangan calon aktif'}</p>
                        </div>
                        <div className="card p-4">
                            <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                                {data.is_final ? 'Status Ledger' : 'Menuju Bilik'}
                            </p>
                            <p className="mt-1.5 text-2xl font-extrabold text-slate-900 tabular-nums sm:text-3xl">
                                {data.is_final ? number(data.ledger?.count ?? data.votes_counted) : number(data.booth_waiting || 0)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {data.is_final ? 'Suara terverifikasi' : 'Sudah check-in di bilik'}
                            </p>
                        </div>
                    </div>

                    {/* Main Content Bento */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <section className="card min-w-0 lg:col-span-2" aria-label="Perolehan suara">
                            <div className="mb-5 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <IconChartBar className="size-5 text-brand-700" />
                                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Perolehan Suara</h2>
                                </div>
                                <span className="text-xs font-medium text-slate-500">Seluruh suara sah</span>
                            </div>

                            <div className="space-y-7">
                            {(data.positions?.length ? data.positions : [{ key: 'pair', label: '', candidates: data.candidates, votes_counted: data.votes_counted }]).map((group) => {
                                const groupTop = group.candidates.reduce((m, c) => Math.max(m, c.votes || 0), 0);
                                const multi = (data.positions?.length || 1) > 1;
                                return (
                            <div key={group.key}>
                            {multi && (
                                <div className="mb-3 flex items-baseline justify-between gap-2">
                                    <h3 className="text-base font-extrabold text-brand-900">{group.label}</h3>
                                    <span className="text-xs font-semibold text-slate-500 tabular-nums">{number(group.votes_counted)} suara</span>
                                </div>
                            )}
                            <ul className="space-y-4">
                                {group.candidates.map((c, i) => {
                                    const leading = groupTop > 0 && c.votes === groupTop;
                                    return (
                                        <li
                                            key={c.id}
                                            className={`rounded-2xl border p-3.5 transition sm:p-4 ${
                                                leading ? 'border-brand-200 bg-brand-50/40' : 'border-slate-100 bg-slate-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3.5">
                                                {c.photo_url ? (
                                                    <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:size-16">
                                                        <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                                                        <span className="absolute right-0 bottom-0 rounded-tl-lg bg-brand-900 px-1.5 py-0.5 text-[10px] font-black text-white">
                                                            {c.number}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 text-xl font-black text-white shadow-xs sm:size-16">
                                                        {c.number}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <p className="truncate text-base font-bold text-slate-900">
                                                                <span className="mr-1.5 text-brand-700">No. {c.number}</span>
                                                                {c.name}
                                                            </p>
                                                            {leading && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                                                    <IconAward className="size-3" /> Memimpin
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="tabular-nums text-sm font-extrabold text-slate-900 sm:text-base">
                                                            {number(c.votes)}{' '}
                                                            <span className="font-semibold text-slate-500">suara ·</span>{' '}
                                                            <span className="text-brand-700">{c.percent}%</span>
                                                        </p>
                                                    </div>
                                                    <div
                                                        className="mt-2.5 h-4 w-full overflow-hidden rounded-full bg-slate-200/80"
                                                        role="img"
                                                        aria-label={`${c.name}: ${c.votes} suara, ${c.percent} persen`}
                                                    >
                                                        <div
                                                            className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-700`}
                                                            style={{ width: `${c.percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            </div>
                                );
                            })}
                            </div>

                            <p className="mt-5 text-xs text-slate-500">
                                {number(data.votes_counted)} surat suara terhitung{data.ballot_mode === 'separate' ? ' (setiap surat suara berisi pilihan ketua dan wakil)' : ''}.
                                {!data.is_final && data.booth_waiting > 0 && (
                                    <> {number(data.booth_waiting)} pemilih sudah check-in dan sedang menuju bilik suara.</>
                                )}
                            </p>
                        </section>

                        <aside className="min-w-0 space-y-6">
                            <section className="card space-y-4" aria-label="Partisipasi">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <IconUsers className="size-5 text-emerald-600" />
                                    <h2 className="text-base font-extrabold text-slate-900">Partisipasi Pemilih</h2>
                                </div>
                                <Participation label="Siswa" data={data.participation.students} barColor="bg-gradient-to-r from-brand-700 to-brand-500" />
                                <Participation label="Guru & Staf" data={data.participation.teachers} barColor="bg-gradient-to-r from-crimson-600 to-crimson-500" />
                                <div className="border-t border-slate-100 pt-3">
                                    <Participation label="Total Keseluruhan" data={data.participation.all} />
                                </div>
                            </section>

                            <section className="card space-y-3 text-sm text-slate-600">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <IconCalendarClock className="size-5 text-brand-700" />
                                    <h2 className="text-base font-extrabold text-slate-900">Jadwal &amp; Integritas</h2>
                                </div>
                                <div className="space-y-1.5 text-xs sm:text-sm">
                                    <div className="flex justify-between gap-2">
                                        <span className="text-slate-500">Dibuka</span>
                                        <span className="font-semibold text-slate-800">{formatDateTime(data.election.opens_at)}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-slate-500">Ditutup</span>
                                        <span className="font-semibold text-slate-800">{formatDateTime(data.election.closes_at)}</span>
                                    </div>
                                </div>

                                {data.is_final && data.ledger.head_hash ? (
                                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                                                <IconCheckCircle className="size-4 text-emerald-600" />
                                                Hash Ledger Final ({number(data.ledger.count)} suara)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => copyHash(data.ledger.head_hash)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 shadow-2xs ring-1 ring-emerald-200 hover:bg-emerald-100"
                                            >
                                                <IconCopy className="size-3" />
                                                {copied ? 'Disalin' : 'Salin'}
                                            </button>
                                        </div>
                                        <code className="mt-2 block rounded-xl bg-white/80 p-2 font-mono text-[11px] break-all text-slate-700">
                                            {data.ledger.head_hash}
                                        </code>
                                    </div>
                                ) : (
                                    <div className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                                        <IconShieldCheck className="mt-0.5 size-4 text-brand-600" />
                                        <span>Hash akhir ledger SHA-256 akan dipublikasikan otomatis setelah hasil resmi ditetapkan.</span>
                                    </div>
                                )}
                            </section>
                        </aside>
                    </div>
                </div>
            )}
        </PublicShell>
    );
}
