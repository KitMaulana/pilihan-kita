import { useMemo, useState } from 'react';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
import { BrandLogo } from '../../components/BrandLogo';
import { IconKey } from '../../components/Icons';
import { useKiosk } from './kioskStore';
import { useIdleReset } from './useCountdown';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Jalur cadangan: siswa = NISN + tgl lahir; guru = NIP + tgl lahir; guru tanpa NIP = nama + tgl lahir (+kode). */
export default function CadanganForm() {
    const identified = useKiosk((s) => s.identified);
    const showMessage = useKiosk((s) => s.showMessage);
    const reset = useKiosk((s) => s.reset);

    const [type, setType] = useState('student');
    const [noNip, setNoNip] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [needCode, setNeedCode] = useState(false);
    const [dob, setDob] = useState({ d: '', m: '', y: '' });
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    useIdleReset(60_000, reset);

    const years = useMemo(() => {
        const now = new Date().getFullYear();
        const from = type === 'student' ? now - 22 : now - 70;
        const to = type === 'student' ? now - 12 : now - 18;
        return Array.from({ length: to - from + 1 }, (_, i) => to - i);
    }, [type]);

    const birthDate = dob.d && dob.m && dob.y ? `${dob.y}-${String(dob.m).padStart(2, '0')}-${String(dob.d).padStart(2, '0')}` : null;
    const usesName = type === 'teacher' && noNip;
    const valid = birthDate && (usesName ? name.trim().length >= 3 : type === 'student' ? /^\d{10}$/.test(identifier) : /^\d{18}$/.test(identifier.replace(/\s/g, '')));

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const payload = { type, birth_date: birthDate };
            if (usesName) {
                payload.name = name.trim();
                if (code.trim()) payload.distinguisher = code.trim();
            } else {
                payload.identifier = identifier.replace(/\s/g, '');
            }
            const { data } = await kiosk.post('/kiosk/fallback', payload);
            identified(data, 'fallback');
        } catch (err) {
            const c = errorCode(err);
            if (c === 'already_voted' || c === 'locked' || c === 'not_eligible') {
                showMessage({
                    tone: c === 'already_voted' ? 'info' : 'danger',
                    title: c === 'already_voted' ? 'Sudah memilih' : 'Tidak dapat melanjutkan',
                    text: errorMessage(err),
                    actions: ['home'],
                });
                return;
            }
            if (c === 'ambiguous_identity') setNeedCode(true);
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    const tab = (value, label) => (
        <button
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => {
                setType(value);
                setIdentifier('');
                setError(null);
            }}
            className={`min-h-12 flex-1 rounded-xl px-4 text-base font-bold transition ${
                type === value ? 'bg-brand-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-1 items-start justify-center p-4 sm:items-center">
            <form onSubmit={submit} className="w-full max-w-xl rounded-3xl border border-white/20 bg-white p-5 text-slate-900 shadow-2xl sm:p-8" autoComplete="off">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                            <IconKey className="size-6" />
                        </span>
                        <div>
                            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Masuk dengan Nomor Induk</h1>
                            <p className="text-xs text-slate-500 sm:text-sm">Jalur setara pengenalan wajah · setiap percobaan dicatat</p>
                        </div>
                    </div>
                    <BrandLogo variant="mark" size="sm" className="hidden sm:inline-flex" />
                </div>

                <div className="mt-5 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5" role="tablist">
                    {tab('student', 'Siswa')}
                    {tab('teacher', 'Guru / Staf')}
                </div>

                <div className="mt-5 space-y-4">
                    {type === 'teacher' && (
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base font-medium text-slate-700">
                            <input type="checkbox" className="size-5 rounded accent-brand-700" checked={noNip} onChange={(e) => setNoNip(e.target.checked)} />
                            Saya tidak memiliki NIP
                        </label>
                    )}

                    {!usesName ? (
                        <div>
                            <label className="label text-base" htmlFor="fb-id">
                                {type === 'student' ? 'NISN (10 digit)' : 'NIP (18 digit)'}
                            </label>
                            <input
                                id="fb-id"
                                className="input min-h-16 text-center font-mono text-2xl font-bold tracking-[0.18em]"
                                inputMode="numeric"
                                pattern="[0-9 ]*"
                                maxLength={type === 'student' ? 10 : 21}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value.replace(/[^\d ]/g, ''))}
                                placeholder={type === 'student' ? '0071234567' : '198001012005011001'}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="label text-base" htmlFor="fb-name">
                                    Nama lengkap (sesuai data sekolah)
                                </label>
                                <input id="fb-name" className="input min-h-14 text-lg" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                            </div>
                            {needCode && (
                                <div>
                                    <label className="label text-base" htmlFor="fb-code">
                                        Kode guru
                                    </label>
                                    <input id="fb-code" className="input min-h-14 text-lg" value={code} onChange={(e) => setCode(e.target.value)} />
                                </div>
                            )}
                        </>
                    )}

                    <fieldset>
                        <legend className="label text-base">Tanggal lahir</legend>
                        <div className="grid grid-cols-[1fr_1.8fr_1.3fr] gap-2">
                            <select className="input min-h-14 text-base sm:text-lg" value={dob.d} onChange={(e) => setDob({ ...dob, d: e.target.value })} aria-label="Tanggal">
                                <option value="">Tgl</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                            <select className="input min-h-14 text-base sm:text-lg" value={dob.m} onChange={(e) => setDob({ ...dob, m: e.target.value })} aria-label="Bulan">
                                <option value="">Bulan</option>
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                            <select className="input min-h-14 text-base sm:text-lg" value={dob.y} onChange={(e) => setDob({ ...dob, y: e.target.value })} aria-label="Tahun">
                                <option value="">Tahun</option>
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </fieldset>

                    {error && (
                        <p className="rounded-xl border border-crimson-200 bg-crimson-50 p-3.5 text-sm font-medium text-crimson-800" role="alert">
                            {error}
                        </p>
                    )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button className="btn-primary min-h-14 text-lg" disabled={!valid || busy}>
                        {busy ? 'Memeriksa…' : 'Lanjut'}
                    </button>
                    <button type="button" className="btn-secondary min-h-14 text-lg" onClick={reset}>
                        Batal
                    </button>
                </div>
            </form>
        </div>
    );
}
