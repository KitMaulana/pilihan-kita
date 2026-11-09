import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook kamera depan. Mengembalikan { videoRef, status, error, start, stop }.
 * status: idle | starting | ready | denied | unavailable | error
 */
export function useCamera({ autoStart = true, width = 640, height = 480 } = {}) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setStatus('idle');
    }, []);

    const start = useCallback(async () => {
        if (streamRef.current) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('unavailable');
            setError('Peramban tidak mendukung kamera atau halaman tidak dibuka lewat HTTPS.');
            return;
        }
        setStatus('starting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'user', width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30, max: 30 } },
            });
            streamRef.current = stream;
            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                video.muted = true;
                video.playsInline = true;
                await video.play().catch(() => {});
            }
            setStatus('ready');
            setError(null);
        } catch (e) {
            const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
            setStatus(denied ? 'denied' : e?.name === 'NotFoundError' ? 'unavailable' : 'error');
            setError(
                denied
                    ? 'Izin kamera ditolak. Buka pengaturan situs di Chrome lalu izinkan kamera.'
                    : e?.name === 'NotFoundError'
                      ? 'Kamera tidak ditemukan pada perangkat ini.'
                      : `Kamera tidak dapat dibuka (${e?.message || e?.name || 'galat'}).`,
            );
        }
    }, [width, height]);

    useEffect(() => {
        if (autoStart) start();
        return () => stop();
    }, [autoStart, start, stop]);

    return { videoRef, status, error, start, stop };
}
