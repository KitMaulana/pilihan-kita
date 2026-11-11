import { useState } from 'react';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

const AUTO_RESET_SECONDS = 8;

/** Layar "check-in berhasil" di meja check-in. Kembali otomatis ke kamera untuk pemilih berikutnya. */
export default function SelesaiPage() {
    const checkin = useKiosk((s) => s.checkin);
    const reset = useKiosk((s) => s.reset);
    const [deadline] = useState(() => Date.now() + AUTO_RESET_SECONDS * 1000);
    const left = useCountdown(deadline, reset);
    const minutes = checkin?.expiresIn ? Math.round(checkin.expiresIn / 60) : null;

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-600" aria-hidden="true">
                    ✓
                </div>
                <h1 className="mt-4 text-3xl font-extrabold">Check-in berhasil</h1>
                {checkin?.name && <p className="mt-2 text-xl font-semibold text-brand-800 break-words">{checkin.name}</p>}

                <div className="mt-6 rounded-2xl bg-brand-50 p-5 text-left">
                    <p className="text-lg font-bold text-brand-900">Langkah berikutnya</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                        <li>Antre dan masuk ke <b>bilik suara</b> yang kosong.</li>
                        <li>Pilih kandidat di layar bilik — pilihan Anda <b>rahasia</b>, bilik tidak tahu siapa Anda.</li>
                        <li>Catat kode resi yang muncul setelah memilih.</li>
                    </ol>
                    {minutes && <p className="mt-3 text-sm text-slate-500">Hak masuk bilik berlaku ±{minutes} menit.</p>}
                </div>

                <button className="btn-primary mt-6 min-h-14 w-full text-lg" onClick={reset}>
                    Selesai ({left})
                </button>
            </div>
        </div>
    );
}
