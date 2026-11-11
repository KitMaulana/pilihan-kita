import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { kiosk, errorMessage } from '../../lib/api';
import { getDeviceToken, setDeviceToken, clearDeviceToken } from '../../lib/device';
import { BrandLogo } from '../../components/BrandLogo';
import { IconDeviceTablet } from '../../components/Icons';
import { Alert, Field } from '../../components/ui';

/**
 * Pemasangan token perangkat di tablet. Panitia membuka tautan dari menu Perangkat
 * (/kiosk/pasang#token=...). Token di fragmen (#) tidak terkirim ke server/log.
 */
export default function PasangPerangkat() {
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const m = window.location.hash.match(/token=([A-Za-z0-9_]+)/);
        if (m) {
            setToken(m[1]);
            history.replaceState(null, '', window.location.pathname); // hapus token dari bilah alamat
        }
    }, []);

    async function save(e) {
        e?.preventDefault();
        setBusy(true);
        setStatus(null);
        const previous = getDeviceToken();
        setDeviceToken(token.trim());
        try {
            const { data } = await kiosk.get('/kiosk/status');
            const booth = data.device.role === 'booth';
            setStatus({
                type: 'success',
                text: `Perangkat terdaftar sebagai “${data.device.name}” (${booth ? 'bilik suara' : 'meja check-in'}). Mengalihkan…`,
            });
            setTimeout(() => navigate(booth ? '/bilik' : '/kiosk', { replace: true }), 1500);
        } catch (err) {
            previous ? setDeviceToken(previous) : clearDeviceToken();
            setStatus({ type: 'danger', text: errorMessage(err, 'Token tidak valid.') });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-4">
            <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
            <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-crimson-600/20 blur-3xl" aria-hidden="true" />

            <form onSubmit={save} className="relative w-full max-w-md space-y-5 rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex flex-col items-center border-b border-slate-100 pb-5 text-center">
                    <BrandLogo variant="full" size="sm" />
                    <div className="mt-4 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                        <IconDeviceTablet className="size-6" />
                    </div>
                    <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">Pasang Perangkat Kiosk</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Tempel token dari menu <strong>Panitia → Perangkat</strong>, atau buka tautan pemasangan langsung di tablet ini.
                    </p>
                </div>

                <Field label="Token perangkat">
                    {(id) => (
                        <input
                            id={id}
                            className="input font-mono text-sm"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="kd_…"
                            required
                            autoComplete="off"
                        />
                    )}
                </Field>

                {status && <Alert type={status.type}>{status.text}</Alert>}

                <div className="space-y-2">
                    <button className="btn-primary min-h-12 w-full" disabled={busy || token.length < 10}>
                        {busy ? 'Memeriksa…' : 'Simpan & Uji Perangkat'}
                    </button>
                    {getDeviceToken() && (
                        <button type="button" className="btn-ghost w-full" onClick={() => navigate('/kiosk')}>
                            Kembali ke kiosk
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
