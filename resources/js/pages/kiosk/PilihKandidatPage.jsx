import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

export default function PilihKandidatPage() {
    const vote = useKiosk((s) => s.vote);
    const done = useKiosk((s) => s.done);
    const showMessage = useKiosk((s) => s.showMessage);
    const [selected, setSelected] = useState(null);
    const [sending, setSending] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const sendingRef = useRef(false);

    const candidates = useQuery({
        queryKey: ['kiosk-candidates'],
        queryFn: () => kiosk.get('/kiosk/candidates').then((r) => r.data.data),
        staleTime: 60_000,
    });

    const left = useCountdown(vote?.expiresAt, () => {
        if (!sendingRef.current) {
            showMessage({ tone: 'warning', title: 'Waktu habis', text: 'Waktu memilih habis dan suara belum dikirim. Silakan ulangi dari awal.', actions: ['home'] });
        }
    });

    /**
     * Kirim suara. Bila koneksi putus sesaat, kirim ulang otomatis dengan idempotency key
     * yang sama (server mengembalikan resi yang sama) selama token belum kedaluwarsa.
     * Pilihan hanya ada di memori, tidak disimpan ke penyimpanan tablet.
     */
    async function submit() {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        const payload = { vote_token: vote.token, candidate_id: selected.id, idempotency_key: vote.idempotencyKey };
        for (;;) {
            try {
                const { data } = await kiosk.post('/kiosk/vote', payload);
                done(data.receipt_code);
                return;
            } catch (err) {
                const code = errorCode(err);
                const transient = code === 'network' || code.startsWith('http_5') || code === 'rate_limited';
                if (transient && Date.now() < vote.expiresAt + 30_000) {
                    setRetrying(true);
                    await new Promise((r) => setTimeout(r, 2500));
                    continue;
                }
                sendingRef.current = false;
                setSending(false);
                showMessage({
                    tone: code === 'already_voted' ? 'info' : 'danger',
                    title: code === 'already_voted' ? 'Suara sudah tercatat' : 'Suara gagal dikirim',
                    text: errorMessage(err),
                    actions: ['home'],
                });
                return;
            }
        }
    }

    return (
        <div className="flex flex-1 flex-col px-4 pb-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-extrabold sm:text-3xl">Pilih Ketua OSIS</h1>
                    <p className="text-brand-100">Sentuh kartu kandidat pilihan Anda.</p>
                </div>
                <p className="text-sm text-brand-100" aria-live="polite">
                    Sisa waktu <span className="tabular-nums text-lg font-bold text-white">{left}</span> dtk
                </p>
            </div>

            {candidates.isLoading && <p>Memuat kandidat…</p>}
            {candidates.isError && <p className="text-red-200">{errorMessage(candidates.error)}</p>}

            <div className="grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {candidates.data?.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="group flex min-h-48 flex-col overflow-hidden rounded-3xl bg-white text-left text-slate-900 shadow-xl ring-brand-400 transition hover:ring-4 focus-visible:ring-4 active:scale-[0.99]"
                        aria-label={`Kandidat nomor ${c.number}, ${c.name}`}
                    >
                        <div className="relative flex-1 bg-slate-100">
                            {c.photo_url ? (
                                <img src={c.photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-slate-300">{c.number}</div>
                            )}
                            <span className="absolute top-3 left-3 flex size-14 items-center justify-center rounded-2xl bg-brand-800 text-3xl font-black text-white shadow-lg">{c.number}</span>
                        </div>
                        <div className="p-4">
                            <p className="text-xl font-bold leading-tight">{c.name}</p>
                            {c.class_name && <p className="text-slate-500">{c.class_name}</p>}
                        </div>
                    </button>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <p className="text-slate-500">Anda akan memilih</p>
                        <p className="mt-2 text-5xl font-black text-brand-800">No. {selected.number}</p>
                        <p className="mt-2 text-2xl font-bold">{selected.name}</p>
                        <p className="mt-4 text-sm text-slate-500">Pilihan tidak dapat diubah setelah dikirim.</p>
                        {retrying && (
                            <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-800" aria-live="assertive">
                                Koneksi terputus — mengirim ulang otomatis…
                            </p>
                        )}
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button className="btn min-h-16 bg-emerald-600 text-xl text-white hover:bg-emerald-700" onClick={submit} disabled={sending}>
                                {sending ? 'Mengirim…' : 'Ya, pilih'}
                            </button>
                            <button className="btn-secondary min-h-16 text-xl" onClick={() => setSelected(null)} disabled={sending}>
                                Kembali
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
