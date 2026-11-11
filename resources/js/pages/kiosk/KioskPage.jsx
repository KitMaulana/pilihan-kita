import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { getDeviceToken } from '../../lib/device';
import { loadFaceEngine } from '../../features/face/faceEngine';
import { loadLiveness } from '../../features/face/liveness';
import { MODEL_VERSION } from '../../features/face/config';
import { IconAlertTriangle, IconCalendarClock, IconDeviceTablet, IconFaceScan, IconRefresh } from '../../components/Icons';
import { Spinner } from '../../components/ui';
import { useKiosk } from './kioskStore';
import { CenterCard, KioskHeader, Screen, useWakeLock } from './shell';
import ScanStep from './ScanStep';
import KonfirmasiPage from './KonfirmasiPage';
import SelesaiPage from './SelesaiPage';
import CadanganForm from './CadanganForm';
import MessageStep from './MessageStep';

/**
 * MEJA CHECK-IN: kenali pemilih (wajah / NISN) → konfirmasi nama → check-in.
 * Pemilih lalu menuju bilik suara (/bilik), yang tidak tahu identitasnya.
 */
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

    const isBooth = status.data?.device?.role === 'booth';
    const open = !!status.data?.election?.is_voting_open && !isBooth;

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
            <CenterCard title="Perangkat belum terdaftar" icon={<IconDeviceTablet className="size-7" />}>
                <p>Tablet ini belum dipasangi token perangkat. Minta panitia membuka menu Perangkat dan memindai/menempel tautan pemasangan.</p>
                <Link to="/kiosk/pasang" className="btn-primary mt-6 w-full">
                    Pasang token perangkat
                </Link>
            </CenterCard>
        );
    }

    if (status.isLoading) {
        return (
            <CenterCard title="Menghubungkan…">
                <p>Memeriksa status pemilihan dan identitas perangkat.</p>
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

    // Perangkat bilik tidak boleh menjalankan check-in.
    if (isBooth) return <Navigate to="/bilik" replace />;

    const election = status.data.election;
    if (status.data.model_version !== MODEL_VERSION) {
        return (
            <CenterCard title="Versi aplikasi tidak cocok" icon={<IconAlertTriangle className="size-7 text-amber-600" />}>
                Versi model di tablet ({MODEL_VERSION}) berbeda dengan server ({status.data.model_version}). Muat ulang halaman; bila tetap, hubungi panitia.
            </CenterCard>
        );
    }

    if (!election || !election.is_voting_open) {
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

    if (engine.error && !faceDisabled) {
        return (
            <CenterCard title="Mesin wajah gagal dimuat" icon={<IconAlertTriangle className="size-7 text-amber-600" />}>
                <p className="text-sm">{engine.error}</p>
                <p className="mt-3 text-sm">Pemilih tetap dapat memakai jalur NISN/NIP.</p>
                <div className="mt-6 grid gap-2.5">
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
        const pct = Math.round(engine.progress * 100);
        return (
            <CenterCard title="Menyiapkan tablet check-in…" icon={<IconFaceScan className="size-7" />}>
                <p className="font-medium text-slate-700">{engine.label}</p>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 font-mono text-xs font-semibold text-brand-700 tabular-nums">{pct}%</p>
                <p className="mt-2 text-xs text-slate-500">Unduhan pertama ±30–50 MB, selanjutnya tersimpan di cache tablet.</p>
            </CenterCard>
        );
    }

    return (
        <Screen>
            <KioskHeader title={election.name} badge="Meja Check-in" deviceName={status.data.device.name} simulation={election.is_simulation} />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
                {step === 'scan' && (faceDisabled ? <CadanganForm /> : <ScanStep requireLiveness={election.require_liveness} />)}
                {step === 'confirm' && <KonfirmasiPage />}
                {step === 'done' && <SelesaiPage />}
                {step === 'fallback' && <CadanganForm />}
                {step === 'message' && <MessageStep />}
            </main>
        </Screen>
    );
}
