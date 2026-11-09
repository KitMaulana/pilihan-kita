import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/useAuth';
import { api } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { Badge } from '../../components/ui';

const NAV = [
    ['/panitia', 'Dasbor', true],
    ['/panitia/jadwal', 'Jadwal & Status'],
    ['/panitia/pemilih', 'Pemilih'],
    ['/panitia/unggah-foto', 'Unggah Foto'],
    ['/panitia/kandidat', 'Kandidat'],
    ['/panitia/perangkat', 'Perangkat'],
    ['/panitia/log', 'Log'],
    ['/panitia/uji-wajah', 'Uji Wajah'],
];

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

    const items = isAdmin ? [...NAV, ['/panitia/pengguna', 'Pengguna']] : NAV;
    const link = ({ isActive }) =>
        `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-700/50 hover:text-white'}`;

    return (
        <div className="min-h-dvh lg:flex">
            <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-brand-900 p-4 transition lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="mb-6 flex items-center gap-2 text-white">
                    <img src="/icon.svg" alt="" className="size-9" />
                    <div>
                        <p className="font-bold leading-tight">Pilihan Kita</p>
                        <p className="text-xs text-brand-200">Panel Panitia</p>
                    </div>
                </div>
                <nav className="space-y-1" onClick={() => setOpen(false)}>
                    {items.map(([to, label, end]) => (
                        <NavLink key={to} to={to} end={end} className={link}>
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="mt-8 border-t border-brand-700 pt-4 text-sm text-brand-200">
                    <p className="truncate text-white">{user?.name}</p>
                    <p className="text-xs uppercase">{user?.role}</p>
                    <button
                        className="btn-sm btn mt-3 w-full border border-brand-600 text-brand-100 hover:bg-brand-800"
                        onClick={async () => {
                            await logout();
                            navigate('/panitia/login');
                        }}
                    >
                        Keluar
                    </button>
                </div>
            </aside>
            {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                    <button className="btn-ghost btn-sm shrink-0 whitespace-nowrap lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
                        ☰ Menu
                    </button>
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="truncate font-semibold text-slate-800">{election?.name || 'Belum ada pemilihan'}</span>
                        {election && <Badge color={election.status === 'open' ? 'green' : 'gray'}>{STATUS_LABEL[election.status]}</Badge>}
                        {election?.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
                    </div>
                    <a href="/hasil" target="_blank" rel="noreferrer" className="hidden text-sm text-brand-700 underline sm:inline">
                        Hasil publik ↗
                    </a>
                </header>
                <main className="mx-auto max-w-6xl p-4 sm:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
