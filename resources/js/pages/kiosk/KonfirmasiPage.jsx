import { useState } from 'react';
import { kiosk, errorMessage } from '../../lib/api';
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
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <p className="text-lg text-slate-500">Apakah ini Anda?</p>
                <p className="mt-4 text-3xl font-extrabold break-words sm:text-4xl">{identity.name}</p>
                <p className="mt-2 text-2xl font-semibold text-brand-700">{identity.class_name}</p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <button className="btn min-h-16 bg-emerald-600 text-xl text-white hover:bg-emerald-700" disabled={busy} onClick={() => answer(true)}>
                        Ya, ini saya — check-in
                    </button>
                    <button className="btn-secondary min-h-16 text-xl" disabled={busy} onClick={() => answer(false)}>
                        Bukan saya
                    </button>
                </div>
                <p className="mt-6 text-sm text-slate-500" aria-live="polite">
                    Sisa waktu: <span className="tabular-nums font-semibold">{left}</span> detik
                </p>
            </div>
        </div>
    );
}
