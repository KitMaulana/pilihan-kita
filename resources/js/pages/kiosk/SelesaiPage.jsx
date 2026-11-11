import { useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { IconCheckCircle, IconVoteBox } from '../../components/Icons';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

const AUTO_RESET_SECONDS = 8;

/** Layar "check-in berhasil" di meja check-in. Kembali otomatis ke kamera untuk pemilih berikutnya. */
export default function SelesaiPage() {
    const checkin = useKiosk((s) => s.checkin);
    const reset = useKiosk((s) => s.reset);
    const [deadline] = useState(() => Date.now() + AUTO_RESET_SECONDS * 1000);
    const left = useCountdown(deadline, reset);

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-10">
                <div className="mb-5 flex justify-center">
                    <BrandLogo variant="full" size="xs" />
                </div>

                <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60" aria-hidden="true">
                    <IconCheckCircle className="size-11" />
                </div>

                <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900">Check-in Berhasil!</h1>
                {checkin?.name && <p className="mt-2 text-xl font-bold text-brand-800 break-words">{checkin.name}</p>}

                <div className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 text-left">
                    <div className="flex items-center gap-2 text-base font-extrabold text-brand-900">
                        <IconVoteBox className="size-5 text-brand-700" />
                        Langkah Berikutnya
                    </div>
                    <ol className="mt-3 space-y-2 text-sm text-slate-700 sm:text-base">
                        <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">1</span>
                            <span>
                                Antre dan masuk ke <b>bilik suara</b> yang kosong.
                            </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">2</span>
                            <span>
                                Pilih kandidat di layar bilik — pilihan Anda <b>rahasia</b>, bilik tidak tahu siapa Anda.
                            </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">3</span>
                            <span>Catat atau foto kode resi yang muncul setelah memilih.</span>
                        </li>
                    </ol>
                </div>

                <button className="btn-primary mt-6 min-h-14 w-full rounded-2xl text-lg" onClick={reset}>
                    Selesai ({left})
                </button>
            </div>
        </div>
    );
}
