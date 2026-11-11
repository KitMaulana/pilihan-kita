import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { getDeviceToken } from '../../lib/device';
import { BrandLogo } from '../../components/BrandLogo';
import { IconAlertTriangle, IconCalendarClock, IconCheckCircle, IconDeviceTablet, IconRefresh, IconShieldCheck, IconVoteBox } from '../../components/Icons';
import { Spinner } from '../../components/ui';
import { CenterCard, KioskHeader, Screen, useWakeLock } from './shell';
import { useCountdown } from './useCountdown';
import PilihKandidatPage from './PilihKandidatPage';

const DONE_SECONDS = 8;
const NOTICE_SECONDS = 6;

/**
 * BILIK SUARA. Perangkat ini TIDAK pernah tahu siapa pemilihnya:
 *  - menunggu sampai ada pemilih yang sudah check-in (hak masuk bilik anonim di server),
 *  - menampilkan surat suara,
 *  - menampilkan resi, lalu kembali otomatis untuk pemilih berikutnya.
 */
export default function BilikPage() {
    const hasToken = !!getDeviceToken();
    const qc = useQueryClient();
    // view: idle (menunggu / surat suara sesuai status) | done (resi) | notice (pesan singkat)
    const [view, setView] = useState({ name: 'idle' });
    const [round, setRound] = useState(0); // kunci untuk mereset surat suara antar-pemilih

    useWakeLock(hasToken);
    useEffect(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    }, []);

    const status = useQuery({
        queryKey: ['kiosk-status'],
        queryFn: () => kiosk.get('/kiosk/status').then((r) => r.data),
        enabled: hasToken,
        refetchInterval: (q) => (q.state.data?.election?.is_voting_open ? 60_000 : 15_000),
        retry: (n, e) => errorCode(e) !== 'device_unauthorized' && n < 3,
    });
    const isBooth = status.data?.device?.role === 'booth';
    const open = !!status.data?.election?.is_voting_open;

    const [ballotOpen, setBallotOpen] = useState(false);
    const booth = useQuery({
        queryKey: ['booth-status'],
        queryFn: () => kiosk.get('/kiosk/booth/status').then((r) => r.data),
        enabled: hasToken && isBooth && open && view.name === 'idle' && !ballotOpen,
        refetchInterval: 3000,
    });

    // Sekali ada pemilih ter-check-in, surat suara tetap tampil sampai suara dikirim
    // (tidak hilang tiba-tiba bila bilik lain memakai hak masuk terakhir).
    useEffect(() => {
        if (booth.data?.ready && view.name === 'idle') setBallotOpen(true);
    }, [booth.data?.ready, view.name]);

    function backToStart() {
        // Buang status antrean lama (masih "siap" dari pemilih sebelumnya) agar surat suara
        // baru tampil lagi hanya setelah server memastikan ada pemilih berikutnya yang check-in.
        qc.setQueryData(['booth-status'], { ready: false, waiting: 0 });
        setBallotOpen(false);
        setView({ name: 'idle' });
        setRound((r) => r + 1);
        qc.invalidateQueries({ queryKey: ['booth-status'] });
    }

    if (!hasToken) {
        return (
            <CenterCard title="Perangkat belum terdaftar" icon={<IconDeviceTablet className="size-7" />}>
                <p>Perangkat bilik ini belum dipasangi token. Minta panitia membuka menu Perangkat, mendaftarkan perangkat dengan peran “Bilik suara”, lalu membuka tautan pemasangan di sini.</p>
                <Link to="/kiosk/pasang" className="btn-primary mt-6 w-full">
                    Pasang token perangkat
                </Link>
            </CenterCard>
        );
    }
    if (status.isLoading) {
        return (
            <CenterCard title="Menghubungkan…">
                <p>Memeriksa status pemilihan dan peran bilik suara.</p>
                <div className="mt-4 flex justify-center">
                    <Spinner />
                </div>
            </CenterCard>
        );
    }
    if (status.isError) {
        const code = errorCode(status.error);
        return (
            <CenterCard title={code === 'device_unauthorized' ? 'Perangkat ditolak' : 'Koneksi terputus'} icon={<IconAlertTriangle className="size-7 text-crimson-600" />}>
                <p>{errorMessage(status.error)}</p>
                <button className="btn-primary mt-6 w-full" onClick={() => status.refetch()}>
                    <IconRefresh className="size-4" />
                    Coba lagi
                </button>
                {code === 'device_unauthorized' && (
                    <Link to="/kiosk/pasang" className="btn-ghost mt-2 w-full">
                        Pasang token baru
                    </Link>
                )}
            </CenterCard>
        );
    }
    if (!isBooth) return <Navigate to="/kiosk" replace />;

    const election = status.data.election;
    if (!election || !open) {
        return (
            <CenterCard title="Pemungutan suara belum dibuka" icon={<IconCalendarClock className="size-7" />}>
                <p>{election?.closed_reason || 'Belum ada pemilihan yang disiapkan.'}</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    <span className="size-2 animate-pulse rounded-full bg-amber-500" />
                    Memeriksa ulang otomatis · {status.data.device.name}
                </p>
            </CenterCard>
        );
    }

    return (
        <Screen>
            <KioskHeader title={election.school_name ? `${election.school_name} · ${election.name}` : election.name} badge="Bilik Suara" deviceName={status.data.device.name} simulation={election.is_simulation} />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
                {view.name === 'done' && <Receipt code={view.receipt} onClose={backToStart} />}
                {view.name === 'notice' && <Notice {...view} onClose={backToStart} />}
                {view.name === 'idle' &&
                    (ballotOpen ? (
                        <PilihKandidatPage
                            key={round}
                            onDone={(receipt) => setView({ name: 'done', receipt })}
                            onFail={(code, text) =>
                                setView({
                                    name: 'notice',
                                    title: code === 'no_checkin' ? 'Belum check-in' : 'Suara gagal dikirim',
                                    text,
                                })
                            }
                        />
                    ) : (
                        <Waiting error={booth.isError ? errorMessage(booth.error) : null} />
                    ))}
            </main>
        </Screen>
    );
}

function Waiting({ error }) {
    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 p-8 text-center backdrop-blur-xl sm:p-12">
                <div className="mx-auto inline-flex rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
                    <BrandLogo variant="full" size="sm" />
                </div>

                <div className="relative mx-auto mt-7 flex size-24 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" aria-hidden="true" />
                    <IconVoteBox className="relative size-11 text-white" />
                </div>

                <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Bilik Suara Siap</h1>
                <p className="mt-3 text-lg text-brand-100 sm:text-xl">Silakan lakukan check-in terlebih dahulu di meja check-in.</p>
                <p className="mt-2 text-sm text-brand-200">Surat suara akan tampil secara otomatis dan anonim setelah Anda check-in.</p>

                <div className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-brand-950/50 px-4 py-2 text-sm font-medium text-brand-100" aria-live="polite">
                    <span className="size-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    Menunggu pemilih berikutnya…
                </div>
                {error && <p className="mt-4 rounded-xl bg-crimson-500/20 px-3 py-2 text-sm text-crimson-100">{error}</p>}
            </div>
        </div>
    );
}

function Receipt({ code, onClose }) {
    const [deadline] = useState(() => Date.now() + DONE_SECONDS * 1000);
    const left = useCountdown(deadline, onClose);
    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mb-4 flex justify-center">
                    <BrandLogo variant="full" size="xs" />
                </div>
                <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60" aria-hidden="true">
                    <IconCheckCircle className="size-11" />
                </div>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Terima kasih!</h1>
                <p className="mt-1.5 text-base font-medium text-slate-600 sm:text-lg">Suara Anda telah resmi tercatat di ledger.</p>

                <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-300 bg-gradient-to-br from-brand-50 via-white to-crimson-50/30 p-5">
                    <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">Kode Resi Pemilih</p>
                    <p className="mt-2 font-mono text-4xl font-black tracking-widest text-brand-900 sm:text-5xl">{code}</p>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-600 sm:text-sm">
                        <IconShieldCheck className="size-4 shrink-0 text-brand-700" />
                        <span>Catat atau foto kode ini untuk mengecek keabsahan di halaman “Cek Resi”.</span>
                    </p>
                </div>

                <button className="btn-primary mt-6 min-h-14 w-full rounded-2xl text-lg" onClick={onClose}>
                    Selesai — keluar bilik ({left})
                </button>
            </div>
        </div>
    );
}

function Notice({ title, text, onClose }) {
    const [deadline] = useState(() => Date.now() + NOTICE_SECONDS * 1000);
    const left = useCountdown(deadline, onClose);
    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                <div className="mb-4 flex justify-center">
                    <BrandLogo variant="full" size="xs" />
                </div>
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200" aria-hidden="true">
                    <IconAlertTriangle className="size-8" />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
                <p className="mt-2 text-base text-slate-600 sm:text-lg" role="alert">
                    {text}
                </p>
                <button className="btn-primary mt-6 min-h-14 w-full rounded-2xl text-lg" onClick={onClose}>
                    Kembali ({left})
                </button>
            </div>
        </div>
    );
}
