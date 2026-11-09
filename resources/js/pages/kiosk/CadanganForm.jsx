import { useMemo, useState } from 'react';
import { kiosk, errorCode, errorMessage } from '../../lib/api';
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
                showMessage({ tone: c === 'already_voted' ? 'info' : 'danger', title: c === 'already_voted' ? 'Sudah memilih' : 'Tidak dapat melanjutkan', text: errorMessage(err), actions: ['home'] });
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
            className={`btn flex-1 text-lg ${type === value ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-1 items-start justify-center p-4 sm:items-center">
            <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-5 text-slate-900 shadow-2xl sm:p-8" autoComplete="off">
                <h1 className="text-2xl font-extrabold">Masuk dengan nomor induk</h1>
                <p className="mt-1 text-slate-600">Jalur ini setara dengan pengenalan wajah. Setiap percobaan dicatat.</p>

                <div className="mt-5 flex gap-2" role="tablist">
                    {tab('student', 'Siswa')}
                    {tab('teacher', 'Guru')}
                </div>

                <div className="mt-5 space-y-4">
                    {type === 'teacher' && (
                        <label className="flex min-h-12 items-center gap-3 text-base">
                            <input type="checkbox" className="size-6" checked={noNip} onChange={(e) => setNoNip(e.target.checked)} />
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
                                className="input min-h-16 text-center font-mono text-2xl tracking-widest"
                                inputMode="numeric"
                                pattern="[0-9 ]*"
                                maxLength={type === 'student' ? 10 : 21}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value.replace(/[^\d ]/g, ''))}
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
                        <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-2">
                            <select className="input min-h-14 text-lg" value={dob.d} onChange={(e) => setDob({ ...dob, d: e.target.value })} aria-label="Tanggal">
                                <option value="">Tgl</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                            <select className="input min-h-14 text-lg" value={dob.m} onChange={(e) => setDob({ ...dob, m: e.target.value })} aria-label="Bulan">
                                <option value="">Bulan</option>
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                            <select className="input min-h-14 text-lg" value={dob.y} onChange={(e) => setDob({ ...dob, y: e.target.value })} aria-label="Tahun">
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
                        <p className="rounded-xl bg-red-50 p-3 text-red-800" role="alert">
                            {error}
                        </p>
                    )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button className="btn-primary min-h-16 text-xl" disabled={!valid || busy}>
                        {busy ? 'Memeriksa…' : 'Lanjut'}
                    </button>
                    <button type="button" className="btn-secondary min-h-16 text-xl" onClick={reset}>
                        Batal
                    </button>
                </div>
            </form>
        </div>
    );
}
