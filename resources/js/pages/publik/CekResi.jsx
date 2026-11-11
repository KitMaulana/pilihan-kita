import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { Alert, Field } from '../../components/ui';
import { IconCheckCircle, IconShieldCheck, IconTicket } from '../../components/Icons';
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
            <div className="mx-auto max-w-xl space-y-6">
                <div className="text-center">
                    <div className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-800 to-brand-600 text-white shadow-md">
                        <IconTicket className="size-7" />
                    </div>
                    <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Cek Kode Resi Suara</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                        Masukkan kode resi yang muncul di layar bilik setelah Anda memilih untuk memverifikasi bahwa suara Anda benar-benar tercatat di ledger.
                    </p>
                </div>

                <form onSubmit={submit} className="card space-y-5">
                    <Field label="Kode Resi Pemilih" hint="Format 10 karakter: XXXX-XXXX-XX (huruf & angka)">
                        {(id) => (
                            <div className="relative">
                                <input
                                    id={id}
                                    className="input min-h-14 pr-16 text-center font-mono text-2xl font-bold tracking-[0.2em] uppercase"
                                    value={code}
                                    onChange={(e) => setCode(format(e.target.value))}
                                    placeholder="ABCD-EFGH-JK"
                                    autoComplete="off"
                                    inputMode="text"
                                    required
                                />
                                {code && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCode('');
                                            setResult(null);
                                            setError(null);
                                        }}
                                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                    >
                                        Hapus
                                    </button>
                                )}
                            </div>
                        )}
                    </Field>
                    <button className="btn-primary min-h-12 w-full text-base" disabled={busy || code.length < 12}>
                        {busy ? 'Memeriksa ledger…' : 'Periksa Kode Resi'}
                    </button>
                </form>

                <div aria-live="polite">
                    {error && <Alert type="danger">{error}</Alert>}
                    {result && (
                        <Alert type={result.recorded ? 'success' : 'warning'} title={result.recorded ? 'Suara Tercatat di Ledger' : 'Kode Resi Tidak Ditemukan'}>
                            {result.message}
                        </Alert>
                    )}
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
                    <IconShieldCheck className="mt-0.5 size-5 text-brand-700" />
                    <div>
                        <p className="font-bold text-slate-900">Mengapa pilihan kandidat tidak ditampilkan?</p>
                        <p className="mt-0.5">
                            Sesuai asas pemilihan <strong>Luber &amp; Jurdil</strong>, sistem hanya mengonfirmasi keberadaan resi di rantai hash tanpa membuka pilihan untuk mencegah paksaan atau jual-beli suara.
                        </p>
                    </div>
                </div>
            </div>
        </PublicShell>
    );
}
