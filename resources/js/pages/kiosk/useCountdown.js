import { useEffect, useState } from 'react';

/** Hitung mundur detik menuju `deadline` (ms epoch). Memanggil onExpire sekali saat habis. */
export function useCountdown(deadline, onExpire) {
    const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    useEffect(() => {
        if (!deadline) return;
        let fired = false;
        const tick = () => {
            const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setLeft(s);
            if (s === 0 && !fired) {
                fired = true;
                onExpire?.();
            }
        };
        tick();
        const t = setInterval(tick, 500);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deadline]);
    return left;
}

/** Reset otomatis bila tidak ada sentuhan selama `ms`. */
export function useIdleReset(ms, onIdle) {
    useEffect(() => {
        let t = setTimeout(onIdle, ms);
        const bump = () => {
            clearTimeout(t);
            t = setTimeout(onIdle, ms);
        };
        const events = ['pointerdown', 'keydown', 'input'];
        events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
        return () => {
            clearTimeout(t);
            events.forEach((e) => window.removeEventListener(e, bump));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ms]);
}
