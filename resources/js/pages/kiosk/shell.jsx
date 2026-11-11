import { useEffect, useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { IconFullscreen } from '../../components/Icons';
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
    return <span className="font-mono text-xs font-semibold tabular-nums sm:text-sm">{formatTime(now.toISOString(), false)} WIB</span>;
}

export function Screen({ children, className = '' }) {
    return (
        <div className={`kiosk relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-[#0e2d76] text-white ${className}`}>
            <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-28 -right-24 size-80 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-crimson-600/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-1 flex-col">{children}</div>
        </div>
    );
}

export function CenterCard({ title, icon = null, children }) {
    return (
        <Screen>
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-800 shadow-2xl sm:p-8">
                    <div className="mb-5 flex justify-center border-b border-slate-100 pb-4">
                        <BrandLogo variant="full" size="sm" />
                    </div>
                    {icon && <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>}
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
                    <div className="mt-2.5 text-sm leading-relaxed text-slate-600 sm:text-base">{children}</div>
                </div>
            </div>
        </Screen>
    );
}

export function KioskHeader({ title, badge, deviceName, simulation }) {
    return (
        <header className="border-b border-white/10 bg-brand-950/50 px-3 py-2.5 backdrop-blur-md sm:px-5">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <BrandLogo variant="full" size="xs" surface="pill" className="hidden sm:inline-flex" />
                    <BrandLogo variant="mark" size="xs" surface="pill" className="sm:hidden" />
                    {badge && (
                        <span className="shrink-0 rounded-xl border border-white/20 bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-white uppercase">
                            {badge}
                        </span>
                    )}
                    <span className="truncate text-sm font-bold tracking-tight text-white sm:text-base">{title}</span>
                    {simulation && (
                        <span className="shrink-0 rounded-lg bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-amber-950 uppercase">
                            SIMULASI
                        </span>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    {deviceName && (
                        <span className="hidden rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-brand-100 md:inline">
                            {deviceName}
                        </span>
                    )}
                    <span className="rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-brand-50">
                        <Clock />
                    </span>
                    <button
                        type="button"
                        className="inline-flex size-9 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
                        onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
                        aria-label="Layar penuh"
                        title="Layar penuh"
                    >
                        <IconFullscreen className="size-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
