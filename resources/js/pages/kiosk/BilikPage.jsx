import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { getDeviceToken } from '../../lib/device';
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
            <CenterCard title="Perangkat belum terdaftar">
                <p>Perangkat bilik ini belum dipasangi token. Minta panitia membuka menu Perangkat, mendaftarkan perangkat dengan peran “Bilik suara”, lalu membuka tautan pemasangan di sini.</p>
                <Link to="/kiosk/pasang" className="btn-primary mt-6 w-full">
                    Pasang token
                </Link>
            </CenterCard>
        );
    }
    if (status.isLoading) return <CenterCard title="Menghubungkan…">Memeriksa status pemilihan.</CenterCard>;
    if (status.isError) {
        const code = errorCode(status.error);
        return (
            <CenterCard title={code === 'device_unauthorized' ? 'Perangkat ditolak' : 'Koneksi terputus'}>
                <p>{errorMessage(status.error)}</p>
                <button className="btn-primary mt-6 w-full" onClick={() => status.refetch()}>
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
            <CenterCard title="Pemungutan suara belum/tidak dibuka">
                <p>{election?.closed_reason || 'Belum ada pemilihan yang disiapkan.'}</p>
                <p className="mt-4 text-sm text-slate-500">Halaman ini memeriksa ulang otomatis. · {status.data.device.name}</p>
            </CenterCard>
        );
    }

    return (
        <Screen>
            <KioskHeader title={election.name} badge="Bilik suara" deviceName={status.data.device.name} simulation={election.is_simulation} />
            <main className="flex flex-1 flex-col">
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
            <div className="w-full max-w-xl text-center">
                <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-white/10 text-5xl" aria-hidden="true">
                    🗳️
                </div>
                <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">Bilik Suara</h1>
                <p className="mt-3 text-xl text-brand-100">Silakan check-in terlebih dahulu di meja check-in.</p>
                <p className="mt-2 text-brand-200">Surat suara akan tampil otomatis setelah Anda check-in.</p>
                <p className="mt-8 inline-flex items-center gap-2 text-sm text-brand-200" aria-live="polite">
                    <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Menunggu pemilih…
                </p>
                {error && <p className="mt-4 text-sm text-red-200">{error}</p>}
            </div>
        </div>
    );
}

function Receipt({ code, onClose }) {
    const [deadline] = useState(() => Date.now() + DONE_SECONDS * 1000);
    const left = useCountdown(deadline, onClose);
    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-600" aria-hidden="true">
                    ✓
                </div>
                <h1 className="mt-4 text-3xl font-extrabold">Terima kasih!</h1>
                <p className="mt-2 text-lg text-slate-600">Suara Anda sudah tercatat.</p>
                <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
                    <p className="text-sm font-medium text-brand-800">Kode resi</p>
                    <p className="mt-1 font-mono text-4xl font-black tracking-widest text-brand-900 sm:text-5xl">{code}</p>
                    <p className="mt-2 text-sm text-slate-600">Catat atau foto kode ini. Cek di halaman “Cek Resi” bahwa suara Anda tercatat (pilihan tidak ditampilkan).</p>
                </div>
                <button className="btn-primary mt-6 min-h-14 w-full text-lg" onClick={onClose}>
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
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl font-black text-amber-700" aria-hidden="true">
                    !
                </div>
                <h1 className="mt-4 text-2xl font-extrabold">{title}</h1>
                <p className="mt-2 text-lg text-slate-600" role="alert">
                    {text}
                </p>
                <button className="btn-primary mt-6 min-h-14 w-full text-lg" onClick={onClose}>
                    Kembali ({left})
                </button>
            </div>
        </div>
    );
}
