import { useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';
import { IconAlertTriangle, IconClose, IconInfoCircle } from '../../components/Icons';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

const TONES = {
    info: { box: 'bg-brand-50 text-brand-700 ring-brand-200', Icon: IconInfoCircle },
    warning: { box: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: IconAlertTriangle },
    danger: { box: 'bg-crimson-50 text-crimson-700 ring-crimson-200', Icon: IconClose },
};

export default function MessageStep() {
    const message = useKiosk((s) => s.message);
    const reset = useKiosk((s) => s.reset);
    const goFallback = useKiosk((s) => s.goFallback);
    const [deadline] = useState(() => Date.now() + 25_000);
    const left = useCountdown(deadline, reset);

    if (!message) return null;
    const actions = message.actions || ['home'];
    const tone = message.tone || 'info';
    const cfg = TONES[tone] || TONES.info;
    const Ico = cfg.Icon;

    // "Coba lagi" mempertahankan hitungan kegagalan wajah, "Kembali ke awal" mereset semuanya.
    const retry = () => useKiosk.setState({ step: 'scan', message: null });

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                <div className="mb-4 flex justify-center">
                    <BrandLogo variant="full" size="xs" />
                </div>
                <div className={`mx-auto flex size-16 items-center justify-center rounded-2xl ring-1 ${cfg.box}`} aria-hidden="true">
                    <Ico className="size-8" />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{message.title}</h1>
                <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg" role="alert">
                    {message.text}
                </p>
                <div className="mt-6 grid gap-3">
                    {actions.map((a) =>
                        a === 'retry' ? (
                            <button key={a} className="btn-primary min-h-14 text-lg" onClick={retry}>
                                Coba lagi dengan wajah
                            </button>
                        ) : a === 'fallback' ? (
                            <button key={a} className={`${actions[0] === 'fallback' ? 'btn-primary' : 'btn-secondary'} min-h-14 text-lg`} onClick={goFallback}>
                                Gunakan NISN / NIP
                            </button>
                        ) : (
                            <button key={a} className="btn-primary min-h-14 text-lg" onClick={reset}>
                                Kembali ke awal
                            </button>
                        ),
                    )}
                </div>
                <p className="mt-4 text-xs font-medium text-slate-400">Kembali ke awal otomatis dalam {left} detik.</p>
            </div>
        </div>
    );
}
