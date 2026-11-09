import { Link, NavLink } from 'react-router-dom';

export default function PublicShell({ children, wide = false }) {
    const link = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:text-white'}`;
    return (
        <div className="min-h-dvh bg-slate-50">
            <header className="bg-brand-800 text-white">
                <div className={`mx-auto flex ${wide ? 'max-w-6xl' : 'max-w-4xl'} flex-wrap items-center justify-between gap-2 px-4 py-3`}>
                    <Link to="/" className="flex items-center gap-2 font-bold">
                        <img src="/icon.svg" alt="" className="size-8" />
                        <span>
                            Pilihan Kita <span className="hidden font-normal text-brand-200 sm:inline">· OSIS SMAN 1 Ciruas</span>
                        </span>
                    </Link>
                    <nav className="flex gap-1">
                        <NavLink to="/hasil" className={link}>
                            Hasil Langsung
                        </NavLink>
                        <NavLink to="/resi" className={link}>
                            Cek Resi
                        </NavLink>
                    </nav>
                </div>
            </header>
            <main className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-4xl'} px-4 py-6`}>{children}</main>
            <footer className="px-4 pb-8 text-center text-xs text-slate-500">
                E-Voting OSIS “One Face One Vote” · Suara bersifat rahasia · Hanya angka agregat yang ditampilkan
            </footer>
        </div>
    );
}
