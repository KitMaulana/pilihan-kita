import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { errorMessage } from '../../lib/api';
import { Alert, Field } from '../../components/ui';

export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (user) return <Navigate to="/panitia" replace />;

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(email, password);
            navigate(location.state?.from || '/panitia', { replace: true });
        } catch (err) {
            setError(errorMessage(err, 'Gagal masuk.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-800 to-brand-900 p-4">
            <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
                <div className="text-center">
                    <img src="/icon.svg" alt="" className="mx-auto size-14" />
                    <h1 className="mt-2 text-xl font-bold text-slate-900">Masuk Panitia</h1>
                    <p className="text-sm text-slate-500">E-Voting OSIS SMAN 1 Ciruas</p>
                </div>
                <Field label="Email">
                    {(id) => <input id={id} type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />}
                </Field>
                <Field label="Kata sandi">
                    {(id) => <input id={id} type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />}
                </Field>
                {error && <Alert type="danger">{error}</Alert>}
                <button className="btn-primary w-full" disabled={busy}>
                    {busy ? 'Memproses…' : 'Masuk'}
                </button>
                <Link to="/" className="block text-center text-sm text-slate-500 underline">
                    Kembali ke beranda
                </Link>
            </form>
        </div>
    );
}
