import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { uuid } from '../../lib/device';
import { IconArrowRight, IconCheckCircle, IconClose, IconShieldCheck } from '../../components/Icons';

const CONFIRM_IDLE_MS = 60_000;

const STEP_TITLE = {
    pair: 'Pilih Ketua & Wakil Ketua OSIS',
    ketua: 'Pilih Ketua OSIS',
    wakil: 'Pilih Wakil Ketua OSIS',
};

/**
 * Surat suara di BILIK. Tidak memegang data pemilih apa pun — server memakai satu
 * hak masuk bilik anonim (hasil check-in) saat suara dikirim.
 *
 * Skema berpasangan: satu langkah (satu pasangan calon).
 * Skema terpisah   : langkah 1 memilih Ketua, langkah 2 memilih Wakil, lalu satu konfirmasi berisi
 *                    kedua pilihan. Keduanya dikirim BERSAMA dalam satu permintaan (satu resi).
 *
 * Bila koneksi putus sesaat, suara dikirim ulang otomatis dengan idempotency key yang sama
 * (server mengembalikan resi yang sama, tidak memakai hak masuk kedua). Pilihan hanya ada di memori.
 */
/** Foto kandidat; bila belum ada / gagal dimuat (jaringan, berkas hilang) tampil nomor kandidat, bukan ikon gambar rusak. */
function CandidatePhoto({ src, number }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [src]);
    if (src && !failed) {
        return <img src={src} alt="" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />;
    }
    return <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-7xl font-black text-slate-300">{number}</div>;
}

export default function PilihKandidatPage({ onDone, onFail, onBusyChange }) {
    const [step, setStep] = useState(0);
    const [picks, setPicks] = useState({}); // jabatan → kandidat (langkah yang sudah dikonfirmasi)
    const [selected, setSelected] = useState(null); // kandidat yang sedang dikonfirmasi pada langkah ini
    const [visionPreview, setVisionPreview] = useState(null);
    const [sending, setSending] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const sendingRef = useRef(false);
    const keyRef = useRef(uuid());

    const ballot = useQuery({
        queryKey: ['kiosk-candidates'],
        queryFn: () => kiosk.get('/kiosk/candidates').then((r) => r.data),
        staleTime: 60_000,
    });

    const positions = ballot.data?.positions?.length ? ballot.data.positions : [{ key: 'pair', label: 'Ketua & Wakil Ketua OSIS' }];
    const current = positions[Math.min(step, positions.length - 1)];
    const isLast = step >= positions.length - 1;
    const multi = positions.length > 1;
    const list = (ballot.data?.data ?? []).filter((c) => (c.position || 'pair') === current.key);

    // Beri tahu induk bila pemilih sudah mulai (jangan tarik layar saat ia sedang memilih).
    const started = !!selected || sending || step > 0 || Object.keys(picks).length > 0;
    useEffect(() => {
        onBusyChange?.(started);
    }, [started, onBusyChange]);

    // Dialog konfirmasi ditutup sendiri bila dibiarkan (pemilih meninggalkan bilik).
    useEffect(() => {
        if (!selected || sending) return;
        const t = setTimeout(() => setSelected(null), CONFIRM_IDLE_MS);
        return () => clearTimeout(t);
    }, [selected, sending]);

    function confirmStep() {
        if (!selected) return;
        if (!isLast) {
            setPicks((p) => ({ ...p, [current.key]: selected }));
            setSelected(null);
            setStep((s) => s + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        submit({ ...picks, [current.key]: selected });
    }

    function resetBallot() {
        setPicks({});
        setStep(0);
        setSelected(null);
    }

    async function submit(finalPicks) {
        if (sendingRef.current) return;
        sendingRef.current = true;
        setSending(true);
        const choices = Object.fromEntries(Object.entries(finalPicks).map(([pos, c]) => [pos, c.id]));
        const payload = { choices, idempotency_key: keyRef.current };
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
                resetBallot();
                keyRef.current = uuid();
                onFail(code, errorMessage(err));
                return;
            }
        }
    }

    // Ringkasan pada konfirmasi terakhir (skema terpisah: Ketua + Wakil).
    const summary = selected ? positions.map((p) => ({ ...p, candidate: p.key === current.key ? selected : picks[p.key] })) : [];

    return (
        <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                    {multi && (
                        <p className="mb-1 text-xs font-bold tracking-wider text-brand-200 uppercase">
                            Langkah {step + 1} dari {positions.length}
                        </p>
                    )}
                    <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{STEP_TITLE[current.key] || `Pilih ${current.label}`}</h1>
                    <p className="mt-1 text-sm text-brand-100 sm:text-base">
                        {multi && !isLast ? 'Sentuh kartu calon pilihan Anda, lalu lanjut ke langkah berikutnya.' : 'Sentuh kartu kandidat pilihan Anda untuk memberikan suara.'}
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-brand-100 backdrop-blur-md">
                    <IconShieldCheck className="size-4 text-emerald-400" />
                    Pilihan Anda rahasia &amp; anonim
                </div>
            </div>

            {multi && (
                <ol className="mb-5 grid gap-2 sm:grid-cols-2" aria-label="Langkah surat suara">
                    {positions.map((p, i) => {
                        const done = picks[p.key];
                        const active = i === step;
                        return (
                            <li
                                key={p.key}
                                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${active ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5'}`}
                                aria-current={active ? 'step' : undefined}
                            >
                                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${done ? 'bg-emerald-500 text-white' : active ? 'bg-white text-brand-900' : 'bg-white/15 text-brand-100'}`}>
                                    {done ? '✓' : i + 1}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-bold text-white">{p.label}</span>
                                    <span className="block truncate text-xs text-brand-100">{done ? `No. ${done.number} · ${done.name}` : active ? 'Sedang dipilih' : 'Belum dipilih'}</span>
                                </span>
                                {done && !sending && (
                                    <button
                                        type="button"
                                        className="ml-auto shrink-0 rounded-xl border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                                        onClick={() => {
                                            setSelected(null);
                                            setStep(i);
                                            setPicks((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => positions.findIndex((x) => x.key === k) < i)));
                                        }}
                                    >
                                        Ubah
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            {ballot.isLoading && <p className="text-brand-100">Memuat daftar kandidat…</p>}
            {ballot.isError && <p className="rounded-xl bg-crimson-500/20 p-4 text-crimson-100">{errorMessage(ballot.error)}</p>}

            <div className="grid flex-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
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
                        aria-label={`${current.key === 'pair' ? 'Kandidat' : current.label} nomor ${c.number}, ${c.name}`}
                    >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                            <CandidatePhoto src={c.photo_url} number={c.number} />
                            <span className="absolute top-3 left-3 flex size-13 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-2xl font-black text-white shadow-lg ring-2 ring-white/80">
                                {c.number}
                            </span>
                        </div>

                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                            <p className="text-xl leading-snug font-extrabold tracking-tight text-slate-900">{c.name}</p>
                            {c.class_name && <p className="mt-0.5 text-sm font-semibold text-brand-700">{c.class_name}</p>}

                            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                                {c.vision || c.mission ? (
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
                                    {current.key === 'pair' ? 'Kandidat' : current.label} No. {visionPreview.number}
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

            {/* Modal Konfirmasi: langkah antara (skema terpisah) atau konfirmasi akhir */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/80 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
                    <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                        {!isLast ? (
                            <>
                                <p className="text-sm font-bold tracking-wider text-slate-500 uppercase">{current.label}</p>
                                <div className="mx-auto mt-3 inline-flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-4xl font-black text-white shadow-lg">
                                    {selected.number}
                                </div>
                                <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{selected.name}</p>
                                {selected.class_name && <p className="text-sm font-semibold text-brand-700">{selected.class_name}</p>}
                                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Pilihan belum dikirim. Lanjutkan untuk memilih {positions[step + 1]?.label}.</p>
                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    <button className="btn-primary min-h-16 rounded-2xl text-xl" onClick={confirmStep}>
                                        Lanjut
                                        <IconArrowRight className="size-5" />
                                    </button>
                                    <button className="btn-secondary min-h-16 rounded-2xl text-xl" onClick={() => setSelected(null)}>
                                        Kembali
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold tracking-wider text-slate-500 uppercase">Konfirmasi Pilihan</p>
                                {multi ? (
                                    <ul className="mt-4 space-y-2 text-left">
                                        {summary.map((p) => (
                                            <li key={p.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                                                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-xl font-black text-white">
                                                    {p.candidate?.number}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-xs font-bold tracking-wider text-slate-500 uppercase">{p.label}</span>
                                                    <span className="block truncate text-lg font-extrabold text-slate-900">{p.candidate?.name}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <>
                                        <div className="mx-auto mt-3 inline-flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-4xl font-black text-white shadow-lg">
                                            {selected.number}
                                        </div>
                                        <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{selected.name}</p>
                                        {selected.class_name && <p className="text-sm font-semibold text-brand-700">{selected.class_name}</p>}
                                    </>
                                )}
                                <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Pilihan bersifat final dan tidak dapat diubah setelah dikirim.</p>

                                {retrying && (
                                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800" aria-live="assertive">
                                        Koneksi terputus — mengirim ulang otomatis…
                                    </p>
                                )}

                                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                    <button
                                        className="btn min-h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-xl font-bold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-emerald-600"
                                        onClick={confirmStep}
                                        disabled={sending}
                                    >
                                        <IconCheckCircle className="size-5" />
                                        {sending ? 'Mengirim…' : multi ? 'Ya, kirim pilihan' : 'Ya, pilih'}
                                    </button>
                                    <button className="btn-secondary min-h-16 rounded-2xl text-xl" onClick={() => setSelected(null)} disabled={sending}>
                                        Kembali
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
