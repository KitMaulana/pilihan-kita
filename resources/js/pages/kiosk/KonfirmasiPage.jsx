import { useState } from 'react';
import { kiosk, errorMessage } from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';
import { IconCheckCircle, IconUserCheck } from '../../components/Icons';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

/** Konfirmasi identitas: NAMA + KELAS, tanpa foto (§2 keputusan #4). */
export default function KonfirmasiPage() {
    const identity = useKiosk((s) => s.identity);
    const checkedIn = useKiosk((s) => s.checkedIn);
    const showMessage = useKiosk((s) => s.showMessage);
    const goFallback = useKiosk((s) => s.goFallback);
    const [busy, setBusy] = useState(false);

    const left = useCountdown(identity?.expiresAt, () =>
        showMessage({ tone: 'warning', title: 'Waktu habis', text: 'Sesi berakhir karena tidak ada konfirmasi. Silakan ulangi.', actions: ['home'] }),
    );

    async function answer(accepted) {
        setBusy(true);
        try {
            const { data } = await kiosk.post('/kiosk/confirm', { ticket: identity.ticket, accepted });
            if (accepted) {
                checkedIn(data);
            } else if (identity.method === 'face') {
                goFallback();
            } else {
                showMessage({ tone: 'info', title: 'Dibatalkan', text: 'Silakan ulangi dari awal atau hubungi panitia.', actions: ['home'] });
            }
        } catch (err) {
            showMessage({ tone: 'danger', title: 'Gagal melanjutkan', text: errorMessage(err), actions: ['home'] });
        } finally {
            setBusy(false);
        }
    }

    if (!identity) return null;

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold tracking-wider text-brand-700 uppercase">
                        <IconUserCheck className="size-4" />
                        Konfirmasi Identitas
                    </span>
                    <BrandLogo variant="mark" size="xs" />
                </div>

                <p className="text-base font-medium text-slate-500 sm:text-lg">Apakah data di bawah ini benar Anda?</p>

                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-6">
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900 break-words sm:text-4xl">{identity.name}</p>
                    <p className="mt-2 inline-flex items-center rounded-full bg-brand-900 px-4 py-1 text-base font-bold text-white sm:text-lg">
                        {identity.class_name}
                    </p>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <button
                        className="btn min-h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 hover:from-emerald-700 hover:to-emerald-600 active:scale-[0.99]"
                        disabled={busy}
                        onClick={() => answer(true)}
                    >
                        <IconCheckCircle className="size-5" />
                        Ya, ini saya — check-in
                    </button>
                    <button className="btn-secondary min-h-16 rounded-2xl text-lg" disabled={busy} onClick={() => answer(false)}>
                        Bukan saya
                    </button>
                </div>

                <p className="mt-6 text-sm text-slate-500" aria-live="polite">
                    Sisa waktu konfirmasi: <span className="font-mono font-bold text-slate-800 tabular-nums">{left}</span> detik
                </p>
            </div>
        </div>
    );
}
