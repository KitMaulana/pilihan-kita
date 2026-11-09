import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDateTime, formatTime, number, percent, STATUS_LABEL } from '../../lib/format';
import { Alert, Badge, Spinner } from '../../components/ui';
import PublicShell from './PublicShell';

// Warna batang dibedakan + diberi label angka (tidak bergantung warna saja).
const BAR_COLORS = ['bg-brand-600', 'bg-amber-500', 'bg-emerald-600', 'bg-rose-600', 'bg-violet-600'];

export function useResults() {
    return useQuery({
        queryKey: ['public-results'],
        queryFn: () => api.get('/public/results').then((r) => r.data),
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
        staleTime: 4000,
    });
}

function Participation({ label, data }) {
    const p = percent(data.voted, data.total);
    return (
        <div>
            <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="tabular-nums text-slate-600">
                    {number(data.voted)} / {number(data.total)} ({p}%)
                </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`Partisipasi ${label}`}>
                <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${p}%` }} />
            </div>
        </div>
    );
}

export default function HasilLangsung() {
    const { data, isLoading, isError, dataUpdatedAt } = useResults();

    return (
        <PublicShell wide>
            {isLoading && <Spinner label="Memuat hasil…" />}
            {isError && <Alert type="danger">Gagal memuat hasil. Mencoba lagi otomatis…</Alert>}
            {data && !data.election && <Alert>Belum ada pemilihan yang disiapkan.</Alert>}
            {data?.election && (
                <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{data.is_final ? 'Hasil Akhir' : 'Hitung Langsung'}</h1>
                            <p className="text-slate-600">{data.election.name}</p>
                        </div>
                        <div className="text-right text-sm">
                            <Badge color={data.election.status === 'open' ? 'green' : data.is_final ? 'blue' : 'gray'}>{STATUS_LABEL[data.election.status]}</Badge>
                            {data.election.is_simulation && (
                                <span className="ml-2">
                                    <Badge color="yellow">SIMULASI</Badge>
                                </span>
                            )}
                            <p className="mt-1 text-slate-500" aria-live="polite">
                                Diperbarui {formatTime(data.generated_at || new Date(dataUpdatedAt).toISOString())} WIB
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <section className="card min-w-0 lg:col-span-2" aria-label="Perolehan suara">
                            <h2 className="mb-4 font-bold text-slate-900">Perolehan suara</h2>
                            <ul className="space-y-5">
                                {data.candidates.map((c, i) => (
                                    <li key={c.id}>
                                        <div className="flex items-center gap-3">
                                            {c.photo_url ? (
                                                <img src={c.photo_url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                                            ) : (
                                                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-500">{c.number}</div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                    <p className="truncate font-semibold text-slate-900">
                                                        <span className="text-slate-500">No. {c.number}</span> {c.name}
                                                    </p>
                                                    <p className="tabular-nums font-bold text-slate-900">
                                                        {number(c.votes)} <span className="font-normal text-slate-500">suara · {c.percent}%</span>
                                                    </p>
                                                </div>
                                                <div className="mt-2 h-5 w-full overflow-hidden rounded-lg bg-slate-100" role="img" aria-label={`${c.name}: ${c.votes} suara, ${c.percent} persen`}>
                                                    <div className={`h-full rounded-lg ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-700`} style={{ width: `${c.percent}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-5 text-xs text-slate-500">
                                {number(data.votes_counted)} suara terhitung.
                                {!data.is_final && data.votes_pending > 0 && (
                                    <>
                                        {' '}
                                        {number(data.votes_pending)} suara terbaru menunggu penyegelan — demi kerahasiaan, suara dihitung per kelompok {data.seal_batch_size} suara.
                                    </>
                                )}
                            </p>
                        </section>

                        <aside className="min-w-0 space-y-6">
                            <section className="card space-y-4" aria-label="Partisipasi">
                                <h2 className="font-bold text-slate-900">Partisipasi</h2>
                                <Participation label="Siswa" data={data.participation.students} />
                                <Participation label="Guru" data={data.participation.teachers} />
                                <div className="border-t border-slate-100 pt-3">
                                    <Participation label="Total" data={data.participation.all} />
                                </div>
                            </section>
                            <section className="card text-sm text-slate-600">
                                <h2 className="mb-2 font-bold text-slate-900">Jadwal</h2>
                                <p>Buka: {formatDateTime(data.election.opens_at)}</p>
                                <p>Tutup: {formatDateTime(data.election.closes_at)}</p>
                                {data.is_final && data.ledger.head_hash && (
                                    <div className="mt-3">
                                        <p className="font-semibold text-slate-800">Hash terakhir ledger ({number(data.ledger.count)} suara)</p>
                                        <code className="mt-1 block rounded-lg bg-slate-100 p-2 text-xs break-all">{data.ledger.head_hash}</code>
                                    </div>
                                )}
                            </section>
                        </aside>
                    </div>
                </>
            )}
        </PublicShell>
    );
}
