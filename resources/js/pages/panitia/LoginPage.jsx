import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { errorMessage } from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';
import { IconArrowRight, IconEye, IconLock, IconShieldCheck } from '../../components/Icons';
import { Alert, Field } from '../../components/ui';

export default function LoginPage() {
    const { user, login: doLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (user) return <Navigate to="/panitia" replace />;

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await doLogin(login, password);
            navigate(location.state?.from || '/panitia', { replace: true });
        } catch (err) {
            setError(errorMessage(err, 'Gagal masuk.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-4">
            <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-28 -right-24 size-80 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 size-80 rounded-full bg-crimson-600/25 blur-3xl" aria-hidden="true" />

            <div className="relative w-full max-w-md space-y-4">
                <form onSubmit={submit} className="rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-8">
                    <div className="border-b border-slate-100 pb-5 text-center">
                        <div className="flex justify-center">
                            <BrandLogo variant="full" size="md" />
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                            <IconLock className="size-3.5" />
                            Portal Panitia Pemilihan
                        </div>
                        <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-slate-900">Masuk ke Panel Kontrol</h1>
                        <p className="mt-1 text-sm text-slate-500">Pilihan Kita · E-Voting OSIS SMAN 1 Ciruas</p>
                    </div>

                    <div className="mt-5 space-y-4">
                        <Field label="Username atau email">
                            {(id) => (
                                <input
                                    id={id}
                                    className="input"
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    placeholder="admin atau panitia"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    required
                                    autoFocus
                                />
                            )}
                        </Field>

                        <Field label="Kata sandi">
                            {(id) => (
                                <div className="relative">
                                    <input
                                        id={id}
                                        type={showPass ? 'text' : 'password'}
                                        className="input pr-11"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass((v) => !v)}
                                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                                    >
                                        <IconEye off={showPass} className="size-4" />
                                    </button>
                                </div>
                            )}
                        </Field>

                        {error && <Alert type="danger">{error}</Alert>}

                        <button className="btn-primary min-h-12 w-full text-base" disabled={busy}>
                            {busy ? 'Memverifikasi…' : 'Masuk ke Dasbor'}
                            {!busy && <IconArrowRight className="size-4" />}
                        </button>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                        <Link to="/" className="font-semibold text-brand-700 hover:underline">
                            ← Kembali ke beranda
                        </Link>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                            <IconShieldCheck className="size-3.5 text-emerald-600" />
                            Sesi Terproteksi
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
}
