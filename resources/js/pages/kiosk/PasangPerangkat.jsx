import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { kiosk, errorMessage } from '../../lib/api';
import { getDeviceToken, setDeviceToken, clearDeviceToken } from '../../lib/device';
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
            setStatus({ type: 'success', text: `Perangkat terdaftar sebagai “${data.device.name}” (${booth ? 'bilik suara' : 'meja check-in'}). Mengalihkan…` });
            setTimeout(() => navigate(booth ? '/bilik' : '/kiosk', { replace: true }), 1500);
        } catch (err) {
            previous ? setDeviceToken(previous) : clearDeviceToken();
            setStatus({ type: 'danger', text: errorMessage(err, 'Token tidak valid.') });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-brand-900 p-4">
            <form onSubmit={save} className="card w-full max-w-md space-y-4">
                <h1 className="text-xl font-bold text-slate-900">Pasang Perangkat Kiosk</h1>
                <p className="text-sm text-slate-600">
                    Tempel token dari menu <strong>Panitia → Perangkat</strong>, atau buka tautan pemasangan langsung di tablet ini.
                </p>
                <Field label="Token perangkat">
                    {(id) => <input id={id} className="input font-mono text-sm" value={token} onChange={(e) => setToken(e.target.value)} placeholder="kd_…" required autoComplete="off" />}
                </Field>
                {status && <Alert type={status.type}>{status.text}</Alert>}
                <button className="btn-primary w-full" disabled={busy || token.length < 10}>
                    {busy ? 'Memeriksa…' : 'Simpan & Uji'}
                </button>
                {getDeviceToken() && (
                    <button type="button" className="btn-ghost w-full" onClick={() => navigate('/kiosk')}>
                        Kembali
                    </button>
                )}
            </form>
        </div>
    );
}
