import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { uuid } from '../../lib/device';
import { IconArrowRight, IconCheckCircle, IconClose, IconShieldCheck } from '../../components/Icons';

const CONFIRM_IDLE_MS = 60_000;

/**
 * Surat suara di BILIK. Tidak memegang data pemilih apa pun — server memakai satu
 * hak masuk bilik anonim (hasil check-in) saat suara dikirim.
 *
 * Bila koneksi putus sesaat, suara dikirim ulang otomatis dengan idempotency key yang sama
 * (server mengembalikan resi yang sama, tidak memakai hak masuk kedua). Pilihan hanya ada di memori.
 */
export default function PilihKandidatPage({ onDone, onFail }) {
    const [selected, setSelected] = useState(null);
    const [visionPreview, setVisionPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const sendingRef = useRef(false);
    const keyRef = useRef(uuid());

    const candidates = useQuery({
        queryKey: ['kiosk-candidates'],
        queryFn: () => kiosk.get('/kiosk/candidates').then((r) => r.data.data),
        staleTime: 60_000,
    });

    // Dialog konfirmasi ditutup sendiri bila dibiarkan (pemilih meninggalkan bilik).
    useEffect(() => {
        if (!selected || sending) return;
        const t = setTimeout(() => setSelected(null), CONFIRM_IDLE_MS);
        return () => clearTimeout(t);
    }, [selected, sending]);

    async function submit() {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        const payload = { candidate_id: selected.id, idempotency_key: keyRef.current };
        const giveUpAt = Date.now() + 45_000;
        for (;;) {
            try {
                const { data } = await kiosk.post('/kiosk/vote', payload);
                onDone(data.receipt_code);
                return;
            } catch (err) {
                const code = errorCode(err);
                const transient = code === 'network' || code.startsWith('http_5') || code === 'rate_limited' || code === 'busy';
                if (transient && Date.now() < giveUpAt) {
                    setRetrying(true);
                    await new Promise((r) => setTimeout(r, 2500));
                    continue;
                }
                sendingRef.current = false;
                setSending(false);
                setRetrying(false);
                setSelected(null);
                keyRef.current = uuid();
                onFail(code, errorMessage(err));
                return;
            }
        }
    }

    return (
        <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Pilih Ketua OSIS</h1>
                    <p className="mt-1 text-sm text-brand-100 sm:text-base">Sentuh kartu kandidat pilihan Anda untuk memberikan suara.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-brand-100 backdrop-blur-md">
                    <IconShieldCheck className="size-4 text-emerald-400" />
                    Pilihan Anda rahasia &amp; anonim
                </div>
            </div>

            {candidates.isLoading && <p className="text-brand-100">Memuat daftar kandidat…</p>}
            {candidates.isError && <p className="rounded-xl bg-crimson-500/20 p-4 text-crimson-100">{errorMessage(candidates.error)}</p>}

            <div className="grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {candidates.data?.map((c) => (
                    <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(c)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelected(c);
                            }
                        }}
                        className="group relative flex min-h-60 cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/20 bg-white text-left text-slate-900 shadow-2xl transition duration-200 hover:-translate-y-1 hover:ring-4 hover:ring-brand-400 focus-visible:ring-4 focus-visible:ring-brand-400 active:scale-[0.99]"
                        aria-label={`Kandidat nomor ${c.number}, ${c.name}`}
                    >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                            {c.photo_url ? (
                                <img src={c.photo_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-7xl font-black text-slate-300">
                                    {c.number}
                                </div>
                            )}
                            <span className="absolute top-3 left-3 flex size-13 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-2xl font-black text-white shadow-lg ring-2 ring-white/80">
                                {c.number}
                            </span>
                        </div>

                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                            <p className="text-xl font-extrabold tracking-tight text-slate-900 leading-snug">{c.name}</p>
                            {c.class_name && <p className="mt-0.5 text-sm font-semibold text-brand-700">{c.class_name}</p>}

                            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                                {(c.vision || c.mission) ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setVisionPreview(c);
                                        }}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                    >
                                        Visi &amp; Misi
                                    </button>
                                ) : (
                                    <span />
                                )}
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2 text-sm font-bold text-brand-800 transition group-hover:bg-brand-800 group-hover:text-white">
                                    Pilih No. {c.number}
                                    <IconArrowRight className="size-4" />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Visi & Misi */}
            {visionPreview && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/75 p-0 backdrop-blur-xs sm:items-center sm:p-4" onClick={() => setVisionPreview(null)}>
                    <div
                        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 text-slate-900 shadow-2xl sm:rounded-3xl"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                                <span className="inline-flex rounded-lg bg-brand-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                                    Kandidat No. {visionPreview.number}
                                </span>
                                <h2 className="mt-1.5 text-xl font-extrabold">{visionPreview.name}</h2>
                                {visionPreview.class_name && <p className="text-sm text-slate-500">{visionPreview.class_name}</p>}
                            </div>
                            <button type="button" onClick={() => setVisionPreview(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                                <IconClose className="size-5" />
                            </button>
                        </div>
                        {visionPreview.vision && (
                            <div className="mt-4">
                                <h3 className="text-xs font-bold tracking-wider text-brand-700 uppercase">Visi</h3>
                                <p className="mt-1 text-sm leading-relaxed text-slate-700">{visionPreview.vision}</p>
                            </div>
                        )}
                        {visionPreview.mission && (
                            <div className="mt-4">
                                <h3 className="text-xs font-bold tracking-wider text-brand-700 uppercase">Misi</h3>
                                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
                                    {visionPreview.mission
                                        .split('\n')
                                        .filter(Boolean)
                                        .map((m, i) => (
                                            <li key={i}>{m}</li>
                                        ))}
                                </ul>
                            </div>
                        )}
                        <div className="mt-6 grid gap-2 sm:grid-cols-2">
                            <button
                                className="btn-primary min-h-12"
                                onClick={() => {
                                    const picked = visionPreview;
                                    setVisionPreview(null);
                                    setSelected(picked);
                                }}
                            >
                                Pilih No. {visionPreview.number}
                            </button>
                            <button className="btn-secondary min-h-12" onClick={() => setVisionPreview(null)}>
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Pilihan */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/80 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                        <p className="text-sm font-bold tracking-wider text-slate-500 uppercase">Konfirmasi Pilihan</p>
                        <div className="mx-auto mt-3 inline-flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-4xl font-black text-white shadow-lg">
                            {selected.number}
                        </div>
                        <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{selected.name}</p>
                        {selected.class_name && <p className="text-sm font-semibold text-brand-700">{selected.class_name}</p>}
                        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                            Pilihan bersifat final dan tidak dapat diubah setelah dikirim.
                        </p>

                        {retrying && (
                            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800" aria-live="assertive">
                                Koneksi terputus — mengirim ulang otomatis…
                            </p>
                        )}

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                            <button
                                className="btn min-h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-xl font-bold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-emerald-600"
                                onClick={submit}
                                disabled={sending}
                            >
                                <IconCheckCircle className="size-5" />
                                {sending ? 'Mengirim…' : 'Ya, pilih'}
                            </button>
                            <button className="btn-secondary min-h-16 rounded-2xl text-xl" onClick={() => setSelected(null)} disabled={sending}>
                                Kembali
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
