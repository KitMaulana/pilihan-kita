import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { kiosk, errorMessage } from '../../lib/api';
import { clearDeviceToken, pairedRoles, setDeviceToken } from '../../lib/device';
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

    const [paired, setPaired] = useState(pairedRoles());

    // Tautan pemasangan memuat token di fragmen (#): langsung diuji & dipasang tanpa menekan tombol.
    useEffect(() => {
        const m = window.location.hash.match(/token=([A-Za-z0-9_]+)/);
        if (m) {
            setToken(m[1]);
            history.replaceState(null, '', window.location.pathname); // hapus token dari bilah alamat
            save(null, m[1]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function save(e, given) {
        e?.preventDefault();
        const value = (given ?? token).trim();
        setBusy(true);
        setStatus(null);
        try {
            // Token baru diuji apa adanya (header eksplisit), BELUM menimpa token yang sudah tersimpan.
            const { data } = await kiosk.get('/kiosk/status', { headers: { 'X-Device-Token': value } });
            const booth = data.device.role === 'booth';
            // Disimpan sesuai perannya: token bilik tidak menimpa token meja check-in (dan sebaliknya).
            setDeviceToken(value, booth ? 'booth' : 'checkin');
            setPaired(pairedRoles());
            setToken('');
            setStatus({
                type: 'success',
                text: `Terpasang sebagai “${data.device.name}” — ${booth ? 'BILIK SUARA' : 'MESIN CHECK-IN'}. Mengalihkan ke ${booth ? 'halaman bilik' : 'halaman check-in'}…`,
            });
            setTimeout(() => navigate(booth ? '/bilik' : '/kiosk', { replace: true }), 1500);
        } catch (err) {
            setStatus({ type: 'danger', text: errorMessage(err, 'Token tidak valid.') });
        } finally {
            setBusy(false);
        }
    }

    function remove(role) {
        clearDeviceToken(role);
        setPaired(pairedRoles());
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
                    <p className="mb-1.5 font-semibold text-slate-700">Terpasang di peramban ini</p>
                    {[
                        ['checkin', 'Mesin check-in (/kiosk)', paired.checkin || paired.legacy],
                        ['booth', 'Bilik suara (/bilik)', paired.booth],
                    ].map(([role, label, on]) => (
                        <div key={role} className="flex min-h-8 items-center justify-between gap-2">
                            <span>
                                {label}: <strong className={on ? 'text-emerald-700' : 'text-slate-400'}>{on ? 'terpasang' : 'belum'}</strong>
                            </span>
                            {on && (
                                <button type="button" className="font-semibold text-crimson-700 underline" onClick={() => remove(role === 'checkin' && paired.legacy && !paired.checkin ? undefined : role)}>
                                    Lepas
                                </button>
                            )}
                        </div>
                    ))}
                    <p className="mt-1.5 text-slate-500">Peran dikenali otomatis dari token. Satu peramban bisa menyimpan keduanya, tetapi di lapangan pakai perangkat terpisah.</p>
                </div>

                <div className="space-y-2">
                    <button className="btn-primary min-h-12 w-full" disabled={busy || token.length < 10}>
                        {busy ? 'Memeriksa…' : 'Simpan & Uji Perangkat'}
                    </button>
                    {(paired.checkin || paired.legacy) && (
                        <button type="button" className="btn-ghost w-full" onClick={() => navigate('/kiosk')}>
                            Buka halaman check-in
                        </button>
                    )}
                    {paired.booth && (
                        <button type="button" className="btn-ghost w-full" onClick={() => navigate('/bilik')}>
                            Buka halaman bilik suara
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
