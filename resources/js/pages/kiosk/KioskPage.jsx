import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { getDeviceToken } from '../../lib/device';
import { formatTime } from '../../lib/format';
import { loadFaceEngine } from '../../features/face/faceEngine';
import { loadLiveness } from '../../features/face/liveness';
import { MODEL_VERSION } from '../../features/face/config';
import { useKiosk } from './kioskStore';
import ScanStep from './ScanStep';
import KonfirmasiPage from './KonfirmasiPage';
import PilihKandidatPage from './PilihKandidatPage';
import SelesaiPage from './SelesaiPage';
import CadanganForm from './CadanganForm';
import MessageStep from './MessageStep';

function useWakeLock(active) {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return;
        let lock = null;
        const request = () =>
            navigator.wakeLock
                .request('screen')
                .then((l) => (lock = l))
                .catch(() => {});
        request();
        const onVis = () => document.visibilityState === 'visible' && request();
        document.addEventListener('visibilitychange', onVis);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            lock?.release().catch(() => {});
        };
    }, [active]);
}

function Clock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return <span className="tabular-nums">{formatTime(now.toISOString(), false)} WIB</span>;
}

function Screen({ children, className = '' }) {
    return <div className={`kiosk flex min-h-dvh flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white ${className}`}>{children}</div>;
}

function CenterCard({ title, children }) {
    return (
        <Screen>
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center text-slate-800 shadow-xl sm:p-8">
                    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                    <div className="mt-3 text-slate-600">{children}</div>
                </div>
            </div>
        </Screen>
    );
}

export default function KioskPage() {
    const hasToken = !!getDeviceToken();
    const step = useKiosk((s) => s.step);
    const reset = useKiosk((s) => s.reset);
    const [engine, setEngine] = useState({ ready: false, progress: 0, label: 'Menyiapkan…', error: null });
    const [faceDisabled, setFaceDisabled] = useState(false);

    useWakeLock(hasToken);

    useEffect(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
        reset();
    }, [reset]);

    const status = useQuery({
        queryKey: ['kiosk-status'],
        queryFn: () => kiosk.get('/kiosk/status').then((r) => r.data),
        enabled: hasToken,
        refetchInterval: (q) => (q.state.data?.election?.is_voting_open ? 60_000 : 15_000),
        retry: (n, e) => errorCode(e) !== 'device_unauthorized' && n < 3,
    });

    const open = !!status.data?.election?.is_voting_open;

    useEffect(() => {
        if (!open || engine.ready) return;
        let cancelled = false;
        (async () => {
            try {
                await loadFaceEngine((p, label) => !cancelled && setEngine((s) => ({ ...s, progress: p * 0.85, label })));
                setEngine((s) => ({ ...s, progress: 0.9, label: 'Memuat pemeriksa gerakan' }));
                await loadLiveness();
                if (!cancelled) setEngine({ ready: true, progress: 1, label: 'Siap', error: null });
            } catch (e) {
                if (!cancelled) setEngine((s) => ({ ...s, error: e.message || String(e) }));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, engine.ready]);

    if (!hasToken) {
        return (
            <CenterCard title="Perangkat belum terdaftar">
                <p>Tablet ini belum dipasangi token perangkat. Minta panitia membuka menu Perangkat dan memindai/menempel tautan pemasangan.</p>
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

    const election = status.data.election;
    if (status.data.model_version !== MODEL_VERSION) {
        return (
            <CenterCard title="Versi aplikasi tidak cocok">
                Versi model di tablet ({MODEL_VERSION}) berbeda dengan server ({status.data.model_version}). Muat ulang halaman; bila tetap, hubungi panitia.
            </CenterCard>
        );
    }

    if (!election || !election.is_voting_open) {
        return (
            <CenterCard title="Pemungutan suara belum/tidak dibuka">
                <p>{election?.closed_reason || 'Belum ada pemilihan yang disiapkan.'}</p>
                <p className="mt-4 text-sm text-slate-500">Halaman ini akan memeriksa ulang secara otomatis. · {status.data.device.name}</p>
            </CenterCard>
        );
    }

    if (engine.error && !faceDisabled) {
        return (
            <CenterCard title="Mesin wajah gagal dimuat">
                <p className="text-sm">{engine.error}</p>
                <p className="mt-3 text-sm">Pemilih tetap dapat memakai jalur NISN/NIP.</p>
                <div className="mt-6 grid gap-2">
                    <button className="btn-primary" onClick={() => location.reload()}>
                        Muat ulang
                    </button>
                    <button className="btn-secondary" onClick={() => setFaceDisabled(true)}>
                        Lanjut tanpa wajah (hanya NISN/NIP)
                    </button>
                </div>
            </CenterCard>
        );
    }

    if (!engine.ready && !faceDisabled) {
        return (
            <CenterCard title="Menyiapkan tablet…">
                <p>{engine.label}</p>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-600 transition-all" style={{ width: `${Math.round(engine.progress * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Unduhan pertama ±30–50 MB, selanjutnya tersimpan di tablet.</p>
            </CenterCard>
        );
    }

    return (
        <Screen>
            <header className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-brand-100">
                <span className="truncate font-semibold text-white">
                    {election.name}
                    {election.is_simulation && <span className="ml-2 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">SIMULASI</span>}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden sm:inline">{status.data.device.name}</span>
                    <Clock />
                    <button
                        className="rounded-lg border border-white/30 px-2 py-1 text-xs"
                        onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
                        aria-label="Layar penuh"
                    >
                        ⛶
                    </button>
                </span>
            </header>
            <main className="flex flex-1 flex-col">
                {step === 'scan' && (faceDisabled ? <CadanganForm /> : <ScanStep requireLiveness={election.require_liveness} />)}
                {step === 'confirm' && <KonfirmasiPage />}
                {step === 'choose' && <PilihKandidatPage />}
                {step === 'done' && <SelesaiPage />}
                {step === 'fallback' && <CadanganForm />}
                {step === 'message' && <MessageStep />}
            </main>
        </Screen>
    );
}
