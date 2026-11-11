import { useEffect, useRef, useState } from 'react';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { useCamera } from '../../features/face/useCamera';
import { analyzeFrame, createLivenessSession, CHALLENGE_TEXT } from '../../features/face/liveness';
import { detectFaces, embedFace } from '../../features/face/faceEngine';
import { MODEL_VERSION, QUALITY } from '../../features/face/config';
import { IconFaceScan, IconKey, IconShieldCheck } from '../../components/Icons';
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
                showMessage({
                    tone: code === 'already_voted' ? 'info' : 'danger',
                    title: code === 'already_voted' ? 'Sudah memilih' : 'Tidak dapat melanjutkan',
                    text: errorMessage(err),
                    actions: ['home'],
                });
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
    const ovalRing =
        phase === 'liveness'
            ? 'border-accent-400 shadow-[0_0_32px_rgba(251,191,36,0.45),0_0_0_9999px_rgba(4,13,38,0.45)]'
            : phase === 'identifying'
              ? 'border-emerald-400 shadow-[0_0_32px_rgba(52,211,153,0.55),0_0_0_9999px_rgba(4,13,38,0.45)]'
              : 'border-white/80 shadow-[0_0_0_9999px_rgba(4,13,38,0.38)]';

    const statusBadge =
        phase === 'liveness'
            ? { dot: 'bg-accent-400', label: 'Verifikasi Gerakan' }
            : phase === 'identifying'
              ? { dot: 'bg-emerald-400', label: 'Mencocokkan Wajah' }
              : { dot: 'bg-brand-400', label: 'Siap Memindai' };

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 lg:flex-row lg:items-stretch lg:gap-8 lg:p-6">
            {/* Viewport Kamera */}
            <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-950 shadow-2xl lg:max-w-lg">
                <video ref={videoRef} className="mirror h-full w-full object-cover" playsInline muted aria-label="Pratinjau kamera" />

                {/* Top status HUD */}
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                        <span className={`size-2 animate-pulse rounded-full ${statusBadge.dot}`} />
                        {statusBadge.label}
                    </span>
                    <span className="rounded-full border border-white/15 bg-slate-950/65 px-2.5 py-1 text-[11px] font-medium text-brand-100 backdrop-blur-md">
                        Lokal
                    </span>
                </div>

                {/* Panduan oval + scan beam */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className={`relative h-[62%] w-[62%] overflow-hidden rounded-[50%] border-4 transition-all duration-300 ${ovalRing}`}>
                        {(phase === 'liveness' || phase === 'identifying') && (
                            <div className="animate-scan-beam absolute inset-x-0 top-1/2 h-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                        )}
                    </div>
                </div>

                {camError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-950/95 p-6 text-center">
                        <IconFaceScan className="size-12 text-crimson-400" />
                        <p className="text-base font-semibold text-white">{error}</p>
                        <button className="btn bg-white text-brand-900 hover:bg-brand-50" onClick={goFallback}>
                            Gunakan NISN / NIP
                        </button>
                    </div>
                )}

                {/* Bottom Instruction HUD */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent px-4 pt-10 pb-5 text-center">
                    <p className="text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-2xl" aria-live="assertive">
                        {hint}
                    </p>
                    {phase === 'liveness' && (
                        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
                            {Array.from({ length: progress.total }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-2 w-12 rounded-full transition-all ${i < progress.index ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-white/25'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Panel Panduan & Jalur Alternatif */}
            <aside className="flex w-full max-w-md flex-col justify-center gap-4 lg:max-w-sm">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wider text-brand-100 uppercase">
                        <IconFaceScan className="size-4 text-accent-400" /> Check-in Pemilih
                    </div>
                    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Selamat datang!</h1>
                    <ol className="mt-4 space-y-3 text-sm text-brand-100 sm:text-base">
                        {[
                            'Lepaskan masker atau kacamata hitam, lalu hadap lurus ke kamera.',
                            `Ikuti instruksi di layar: ${CHALLENGE_TEXT.blink.toLowerCase()} dan tolehkan kepala.`,
                            'Pastikan nama & kelas benar, lalu masuk ke bilik suara.',
                        ].map((txt, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 font-mono text-xs font-bold text-white">
                                    {idx + 1}
                                </span>
                                <span className="leading-snug">{txt}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                <button
                    className="btn min-h-16 rounded-2xl border-2 border-white/40 bg-white/10 text-lg font-bold text-white backdrop-blur-md transition hover:border-white/70 hover:bg-white/20 active:scale-[0.99]"
                    onClick={goFallback}
                >
                    <IconKey className="size-5 text-accent-400" />
                    Gunakan NISN / NIP
                </button>

                <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-brand-950/40 px-4 py-2.5 text-center text-xs text-brand-200">
                    <IconShieldCheck className="size-4 shrink-0 text-emerald-400" />
                    <span>Tablet tidak menyimpan foto Anda. Hanya vektor angka yang dikirim ke server sekolah.</span>
                </div>
            </aside>
        </div>
    );
}
