import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';
import { useState } from 'react';

const AUTO_RESET_SECONDS = 20;

export default function SelesaiPage() {
    const receipt = useKiosk((s) => s.receipt);
    const reset = useKiosk((s) => s.reset);
    const [deadline] = useState(() => Date.now() + AUTO_RESET_SECONDS * 1000);
    const left = useCountdown(deadline, reset);

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-600" aria-hidden="true">
                    ✓
                </div>
                <h1 className="mt-4 text-3xl font-extrabold">Terima kasih!</h1>
                <p className="mt-2 text-lg text-slate-600">Suara Anda sudah tercatat.</p>

                <div className="mt-6 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4">
                    <p className="text-sm font-medium text-brand-800">Kode resi Anda</p>
                    <p className="mt-1 font-mono text-4xl font-black tracking-widest text-brand-900 sm:text-5xl">{receipt}</p>
                    <p className="mt-2 text-sm text-slate-600">Catat atau foto kode ini. Cek di halaman “Cek Resi” untuk memastikan suara Anda tercatat (pilihan tidak ditampilkan).</p>
                </div>

                <button className="btn-primary mt-6 min-h-14 w-full text-lg" onClick={reset}>
                    Selesai ({left})
                </button>
            </div>
        </div>
    );
}
