/** Pilihan skema surat suara sebuah sesi: berpasangan atau ketua & wakil dipilih terpisah. */
const MODES = [
    {
        value: 'pair',
        title: 'Berpasangan',
        desc: 'Ketua & wakil satu paket. Pemilih memilih satu pasangan calon.',
        example: 'No. 1 Raka & Nadia',
    },
    {
        value: 'separate',
        title: 'Ketua & wakil terpisah',
        desc: 'Pemilih memilih calon Ketua, lalu memilih calon Wakil secara terpisah.',
        example: 'Ketua: No. 2 Raka · Wakil: No. 1 Nadia',
    },
];

export default function BallotModePicker({ value, onChange }) {
    return (
        <div role="radiogroup" aria-label="Skema pemilihan" className="grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => {
                const active = value === m.value;
                return (
                    <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(m.value)}
                        className={`flex flex-col gap-1 rounded-2xl border-2 p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            active ? 'border-brand-700 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <span className={`flex size-4 items-center justify-center rounded-full border-2 ${active ? 'border-brand-700' : 'border-slate-300'}`} aria-hidden="true">
                                {active && <span className="size-2 rounded-full bg-brand-700" />}
                            </span>
                            <span className={`font-bold ${active ? 'text-brand-900' : 'text-slate-800'}`}>{m.title}</span>
                        </span>
                        <span className="text-sm text-slate-600">{m.desc}</span>
                        <span className="text-xs font-medium text-slate-400">Contoh surat suara: {m.example}</span>
                    </button>
                );
            })}
        </div>
    );
}
