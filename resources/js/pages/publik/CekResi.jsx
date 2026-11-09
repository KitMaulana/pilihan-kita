import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { Alert, Field } from '../../components/ui';
import PublicShell from './PublicShell';

export default function CekResi() {
    const [code, setCode] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const format = (v) => {
        const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        return [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 10)].filter(Boolean).join('-');
    };

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const { data } = await api.post('/public/receipt', { code });
            setResult(data);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <PublicShell>
            <div className="mx-auto max-w-lg">
                <h1 className="text-2xl font-extrabold text-slate-900">Cek Kode Resi</h1>
                <p className="mt-1 text-slate-600">
                    Masukkan kode resi yang Anda terima setelah memilih. Halaman ini hanya memastikan suara Anda <strong>tercatat</strong> — pilihan Anda tidak ditampilkan,
                    demi mencegah paksaan atau jual-beli suara.
                </p>
                <form onSubmit={submit} className="card mt-6 space-y-4">
                    <Field label="Kode resi" hint="Format: XXXX-XXXX-XX">
                        {(id) => (
                            <input
                                id={id}
                                className="input text-center font-mono text-2xl tracking-widest uppercase"
                                value={code}
                                onChange={(e) => setCode(format(e.target.value))}
                                placeholder="ABCD-EFGH-JK"
                                autoComplete="off"
                                inputMode="text"
                                required
                            />
                        )}
                    </Field>
                    <button className="btn-primary w-full" disabled={busy || code.length < 12}>
                        {busy ? 'Memeriksa…' : 'Periksa'}
                    </button>
                </form>
                <div className="mt-4" aria-live="polite">
                    {error && <Alert type="danger">{error}</Alert>}
                    {result && (
                        <Alert type={result.recorded ? 'success' : 'warning'} title={result.recorded ? '✔ Tercatat' : 'Tidak ditemukan'}>
                            {result.message}
                        </Alert>
                    )}
                </div>
            </div>
        </PublicShell>
    );
}
