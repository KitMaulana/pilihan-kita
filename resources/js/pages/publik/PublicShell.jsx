import { Link, NavLink } from 'react-router-dom';
import { BrandLockup, BrandLogo } from '../../components/BrandLogo';
import { IconArrowRight, IconChartBar, IconLock, IconTicket } from '../../components/Icons';

export default function PublicShell({ children, wide = false }) {
    const maxW = wide ? 'max-w-6xl' : 'max-w-5xl';
    const navCls = ({ isActive }) =>
        `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-3.5 sm:text-sm ${
            isActive
                ? 'bg-brand-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-brand-900'
        }`;

    return (
        <div className="bg-light-grid flex min-h-dvh flex-col">
            <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
                <div className="h-1 w-full bg-gradient-to-r from-brand-800 via-brand-500 to-crimson-600" aria-hidden="true" />
                <div className={`mx-auto flex ${maxW} flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:py-3`}>
                    <Link to="/" className="min-w-0 rounded-xl py-0.5 focus-visible:outline-offset-4">
                        <BrandLockup size="sm" subtitle="E-Voting OSIS" />
                    </Link>

                    <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Navigasi utama">
                        <NavLink to="/" end className={navCls}>
                            Beranda
                        </NavLink>
                        <NavLink to="/hasil" className={navCls}>
                            <IconChartBar className="hidden size-4 sm:block" />
                            Hitung Langsung
                        </NavLink>
                        <NavLink to="/resi" className={navCls}>
                            <IconTicket className="hidden size-4 sm:block" />
                            Cek Resi
                        </NavLink>
                        <Link
                            to="/panitia/login"
                            className="ml-1 hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 sm:inline-flex"
                        >
                            <IconLock className="size-3.5" />
                            Panitia
                            <IconArrowRight className="size-3.5" />
                        </Link>
                    </nav>
                </div>
            </header>

            <main className={`mx-auto w-full flex-1 ${maxW} px-4 py-6 sm:py-8`}>{children}</main>

            <footer className="mt-auto border-t border-slate-200/80 bg-white/80 backdrop-blur-xs">
                <div className={`mx-auto flex ${maxW} flex-col items-center justify-between gap-4 px-4 py-6 text-center sm:flex-row sm:text-left`}>
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                        <BrandLogo variant="full" size="xs" />
                        <span className="hidden h-4 w-px bg-slate-300 sm:inline-block" aria-hidden="true" />
                        <span className="text-xs font-medium text-slate-500">
                            Pilihan Kita · E-Voting OSIS
                        </span>
                    </div>
                    <p className="text-xs text-slate-500">
                        Suara bersifat rahasia · Hanya angka agregat yang ditampilkan ke publik
                    </p>
                </div>
            </footer>
        </div>
    );
}
