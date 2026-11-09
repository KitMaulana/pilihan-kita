import { useState } from 'react';
import { useKiosk } from './kioskStore';
import { useCountdown } from './useCountdown';

const TONES = {
    info: 'bg-brand-100 text-brand-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
};
const ICONS = { info: 'i', warning: '!', danger: '×' };

export default function MessageStep() {
    const message = useKiosk((s) => s.message);
    const reset = useKiosk((s) => s.reset);
    const goFallback = useKiosk((s) => s.goFallback);
    const [deadline] = useState(() => Date.now() + 25_000);
    const left = useCountdown(deadline, reset);

    if (!message) return null;
    const actions = message.actions || ['home'];
    const tone = message.tone || 'info';

    // "Coba lagi" mempertahankan hitungan kegagalan wajah, "Kembali ke awal" mereset semuanya.
    const retry = () => useKiosk.setState({ step: 'scan', message: null });

    return (
        <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl sm:p-8">
                <div className={`mx-auto flex size-16 items-center justify-center rounded-full text-3xl font-black ${TONES[tone]}`} aria-hidden="true">
                    {ICONS[tone]}
                </div>
                <h1 className="mt-4 text-2xl font-extrabold">{message.title}</h1>
                <p className="mt-2 text-lg text-slate-600" role="alert">
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
                <p className="mt-4 text-xs text-slate-400">Kembali ke awal otomatis dalam {left} detik.</p>
            </div>
        </div>
    );
}
