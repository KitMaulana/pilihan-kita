import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/useAuth';
import { api } from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';
import {
    IconActivity,
    IconAward,
    IconCalendarClock,
    IconClose,
    IconDashboard,
    IconDeviceTablet,
    IconExternal,
    IconFaceScan,
    IconLogOut,
    IconMenu,
    IconShieldCheck,
    IconSchool,
    IconUpload,
    IconUsers,
} from '../../components/Icons';
import SessionSwitcher from '../../components/SessionSwitcher';

const NAV = [
    { to: '/panitia', label: 'Dasbor', end: true, Icon: IconDashboard },
    { to: '/panitia/jadwal', label: 'Jadwal & Status', Icon: IconCalendarClock },
    { to: '/panitia/pemilih', label: 'Pemilih', Icon: IconUsers },
    { to: '/panitia/unggah-foto', label: 'Unggah Foto', Icon: IconUpload },
    { to: '/panitia/kandidat', label: 'Kandidat', Icon: IconAward },
    { to: '/panitia/perangkat', label: 'Perangkat', Icon: IconDeviceTablet },
    { to: '/panitia/log', label: 'Log Aktivitas', Icon: IconActivity },
    { to: '/panitia/uji-wajah', label: 'Uji Wajah', Icon: IconFaceScan },
];

/** Sesi (pemilihan sekolah) yang sedang dikelola. Kunci query ikut berubah saat pindah sesi (lihat switchSession). */
export function useElection() {
    return useQuery({
        queryKey: ['election'],
        queryFn: () => api.get('/panitia/election').then((r) => r.data.data),
    });
}

export default function PanitiaLayout() {
    const { user, isAdmin, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const { data: election } = useElection();

    const items = isAdmin
        ? [{ to: '/panitia/sesi', label: 'Sesi Sekolah', Icon: IconSchool }, ...NAV, { to: '/panitia/pengguna', label: 'Pengguna', Icon: IconShieldCheck }]
        : NAV;
    const linkCls = ({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
            isActive
                ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-950/40'
                : 'text-brand-100/80 hover:bg-white/10 hover:text-white'
        }`;

    const initial = (user?.name || 'P').trim().charAt(0).toUpperCase();

    return (
        <div className="bg-light-grid min-h-dvh lg:flex">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-gradient-to-b from-brand-950 via-brand-900 to-[#081d4f] p-4 text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="mb-5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <BrandLogo variant="full" size="xs" surface="pill" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-brand-200 uppercase">
                            <span>Pilihan Kita</span>
                            <span className="rounded bg-crimson-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white">Panitia</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-xl p-2 text-brand-200 hover:bg-white/10 hover:text-white lg:hidden"
                        aria-label="Tutup menu"
                    >
                        <IconClose className="size-5" />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto pr-1" onClick={() => setOpen(false)} aria-label="Menu panitia">
                    {items.map(({ to, label, end, Icon }) => (
                        <NavLink key={to} to={to} end={end} className={linkCls}>
                            <Icon className="size-4.5 opacity-90" />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-crimson-600 font-bold text-white shadow-xs">
                            {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-white">{user?.name}</p>
                            <p className="text-[11px] font-semibold tracking-wider text-brand-200 uppercase">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-100 transition hover:bg-crimson-600 hover:border-crimson-500 hover:text-white"
                        onClick={async () => {
                            await logout();
                            navigate('/panitia/login');
                        }}
                    >
                        <IconLogOut className="size-4" />
                        Keluar
                    </button>
                </div>
            </aside>

            {open && <div className="fixed inset-0 z-30 bg-brand-950/50 backdrop-blur-xs lg:hidden" onClick={() => setOpen(false)} />}

            {/* Main Area */}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
                    <div className="h-0.5 w-full bg-gradient-to-r from-brand-800 via-brand-500 to-crimson-600" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <button
                                className="btn-ghost btn-sm shrink-0 border border-slate-200 px-2.5 lg:hidden"
                                onClick={() => setOpen(true)}
                                aria-label="Buka menu"
                            >
                                <IconMenu className="size-5" />
                            </button>
                            <SessionSwitcher isAdmin={isAdmin} />
                        </div>

                        <a
                            href={election?.public_url || '/hasil'}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:bg-brand-50"
                        >
                            <span className="hidden sm:inline">Hasil Publik</span>
                            <span className="sm:hidden">Hasil</span>
                            <IconExternal className="size-3.5" />
                        </a>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
