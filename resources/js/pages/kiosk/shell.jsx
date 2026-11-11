import { useEffect, useState } from 'react';
import { formatTime } from '../../lib/format';

/** Kerangka layar bersama untuk meja check-in (/kiosk) dan bilik suara (/bilik). */

export function useWakeLock(active) {
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

export function Clock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return <span className="tabular-nums">{formatTime(now.toISOString(), false)} WIB</span>;
}

export function Screen({ children, className = '' }) {
    return <div className={`kiosk flex min-h-dvh flex-col bg-gradient-to-b from-brand-900 to-brand-800 text-white ${className}`}>{children}</div>;
}

export function CenterCard({ title, children }) {
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

export function KioskHeader({ title, badge, deviceName, simulation }) {
    return (
        <header className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-brand-100">
            <span className="flex min-w-0 items-center gap-2">
                {badge && <span className="shrink-0 rounded-lg bg-white/15 px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">{badge}</span>}
                <span className="truncate font-semibold text-white">{title}</span>
                {simulation && <span className="shrink-0 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">SIMULASI</span>}
            </span>
            <span className="flex shrink-0 items-center gap-3">
                <span className="hidden sm:inline">{deviceName}</span>
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
    );
}
