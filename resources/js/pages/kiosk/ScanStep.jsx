import { useEffect, useRef, useState } from 'react';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { useCamera } from '../../features/face/useCamera';
import { analyzeFrame, createLivenessSession, CHALLENGE_TEXT } from '../../features/face/liveness';
import { detectFaces, embedFace } from '../../features/face/faceEngine';
import { MODEL_VERSION, QUALITY } from '../../features/face/config';
import { useKiosk } from './kioskStore';

const STABLE_FRAMES = 10;

/**
 * Langkah pemindaian: tunggu satu wajah stabil → liveness aktif → ambil frame frontal →
 * embedding di browser → kirim VEKTOR ke /kiosk/identify.
 */
export default function ScanStep({ requireLiveness = true }) {
    const { videoRef, status, error } = useCamera();
    const identified = useKiosk((s) => s.identified);
    const showMessage = useKiosk((s) => s.showMessage);
    const goFallback = useKiosk((s) => s.goFallback);
    const faceFailed = useKiosk((s) => s.faceFailed);
    const faceFailures = useKiosk((s) => s.faceFailures);

    const [phase, setPhase] = useState('waiting'); // waiting | liveness | identifying
    const [hint, setHint] = useState('Berdiri di depan kamera');
    const [progress, setProgress] = useState({ index: 0, total: 3 });
    const phaseRef = useRef('waiting');
    const sessionRef = useRef(null);
    const stableRef = useRef(0);
    const busyRef = useRef(false);

    const setPhaseBoth = (p) => {
        phaseRef.current = p;
        setPhase(p);
    };

    useEffect(() => {
        if (status !== 'ready') return;
        let raf = 0;
        let alive = true;
        let lastUi = 0;

        const loop = async () => {
            if (!alive) return;
            const video = videoRef.current;
            if (video && !busyRef.current) {
                const frame = analyzeFrame(video);
                const now = performance.now();
                const ui = now - lastUi > 150;
                if (ui) lastUi = now;

                if (phaseRef.current === 'waiting') {
                    if (!frame || frame.faces === 0) {
                        stableRef.current = 0;
                        if (ui) setHint('Berdiri di depan kamera');
                    } else if (frame.faces > 1) {
                        stableRef.current = 0;
                        if (ui) setHint('Hanya satu orang di depan kamera');
                    } else if (frame.size < QUALITY.minFaceRatioKiosk) {
                        stableRef.current = 0;
                        if (ui) setHint('Dekatkan wajah ke kamera');
                    } else if (++stableRef.current >= STABLE_FRAMES) {
                        stableRef.current = 0;
                        if (requireLiveness) {
                            sessionRef.current = createLivenessSession();
                            setPhaseBoth('liveness');
                        } else {
                            busyRef.current = true;
                            await capture(true, []);
                            busyRef.current = false;
                        }
                    } else if (ui) {
                        setHint('Tahan sebentar…');
                    }
                } else if (phaseRef.current === 'liveness') {
                    const r = sessionRef.current.step(frame);
                    if (ui) {
                        setHint(r.message);
                        setProgress({ index: r.index, total: r.total });
                    }
                    if (r.done) {
                        busyRef.current = true;
                        await capture(r.passed, sessionRef.current.challenges, r.message);
                        busyRef.current = false;
                    }
                }
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            alive = false;
            cancelAnimationFrame(raf);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, requireLiveness]);

    async function capture(passed, challenges, reason = '') {
        setPhaseBoth('identifying');
        setHint(passed ? 'Mengenali wajah…' : 'Memeriksa…');
        const video = videoRef.current;
        try {
            const faces = await detectFaces(video);
            if (faces.length === 0) {
                return fail(passed ? 'Wajah tidak terlihat jelas. Coba lagi.' : `Verifikasi gerakan gagal (${reason}).`, passed ? 'retry' : 'liveness');
            }
            if (faces.length > 1) return fail('Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di depan kamera.', 'retry');

            const { embedding } = await embedFace(video, faces[0]);
            const { data } = await kiosk.post('/kiosk/identify', {
                embedding,
                model_version: MODEL_VERSION,
                liveness: { passed, challenges },
            });
            identified(data, 'face');
        } catch (err) {
            const code = errorCode(err);
            if (code === 'already_voted' || code === 'not_eligible' || code === 'voting_closed') {
                showMessage({ tone: code === 'already_voted' ? 'info' : 'danger', title: code === 'already_voted' ? 'Sudah memilih' : 'Tidak dapat melanjutkan', text: errorMessage(err), actions: ['home'] });
                return;
            }
            fail(errorMessage(err), code === 'liveness_failed' ? 'liveness' : 'retry');
        }
    }

    function fail(text, kind) {
        faceFailed();
        const many = faceFailures + 1 >= 2;
        showMessage({
            tone: 'warning',
            title: kind === 'liveness' ? 'Verifikasi gerakan tidak berhasil' : 'Wajah belum dikenali',
            text: many ? `${text} Anda dapat memakai NISN/NIP + tanggal lahir.` : text,
            actions: many ? ['fallback', 'retry'] : ['retry', 'fallback'],
        });
    }

    const camError = status === 'denied' || status === 'unavailable' || status === 'error';

    return (
        <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-6 lg:flex-row lg:items-stretch lg:justify-center lg:gap-8">
            <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl bg-black shadow-2xl lg:max-w-lg">
                <video ref={videoRef} className="mirror h-full w-full object-cover" playsInline muted aria-label="Pratinjau kamera" />
                {/* Panduan oval */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                        className={`h-[62%] w-[62%] rounded-[50%] border-4 transition-colors ${
                            phase === 'liveness' ? 'border-accent-400' : phase === 'identifying' ? 'border-emerald-400' : 'border-white/70'
                        }`}
                    />
                </div>
                {camError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6 text-center">
                        <p>{error}</p>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
                    <p className="text-xl font-bold sm:text-2xl" aria-live="assertive">
                        {hint}
                    </p>
                    {phase === 'liveness' && (
                        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
                            {Array.from({ length: progress.total }).map((_, i) => (
                                <span key={i} className={`h-2 w-10 rounded-full ${i < progress.index ? 'bg-emerald-400' : 'bg-white/30'}`} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <aside className="flex w-full max-w-md flex-col justify-center gap-4 lg:max-w-sm">
                <div className="rounded-2xl bg-white/10 p-5">
                    <h1 className="text-2xl font-extrabold">Selamat datang!</h1>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-brand-100">
                        <li>Lepaskan masker/kacamata hitam, hadap kamera.</li>
                        <li>Ikuti instruksi: {CHALLENGE_TEXT.blink.toLowerCase()} dan tolehkan kepala.</li>
                        <li>Pastikan nama Anda benar, lalu pilih kandidat.</li>
                    </ol>
                </div>
                <button className="btn min-h-16 border-2 border-white/60 text-lg text-white hover:bg-white/10" onClick={goFallback}>
                    Gunakan NISN / NIP
                </button>
                <p className="text-center text-xs text-brand-200">Tablet tidak menyimpan foto Anda. Hanya angka (vektor) yang dikirim ke server.</p>
            </aside>
        </div>
    );
}
