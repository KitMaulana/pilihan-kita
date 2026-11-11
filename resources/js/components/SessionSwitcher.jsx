import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { STATUS_LABEL } from '../lib/format';
import { getSessionId, setSessionId } from '../lib/session';
import { Badge } from './ui';
import { IconChevronDown, IconSchool } from './Icons';

export function useSessions() {
    return useQuery({
        queryKey: ['sessions'],
        queryFn: () => api.get('/panitia/sessions').then((r) => r.data),
        staleTime: 30_000,
    });
}

/** Pindah sesi: simpan pilihan lalu muat ulang SEMUA data panel untuk sekolah tersebut. */
export function switchSession(qc, id) {
    setSessionId(id);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    qc.invalidateQueries();
}

const statusColor = (s) => (s === 'open' ? 'green' : s === 'published' ? 'blue' : s === 'closed' ? 'red' : 'gray');

/**
 * Pemilih sesi (sekolah) di header panel. Panitia yang dibatasi hanya melihat sekolahnya (tanpa menu).
 * Bila sesi tersimpan sudah tidak ada / tidak boleh diakses, otomatis memakai sesi yang dipilih server.
 */
export default function SessionSwitcher({ isAdmin }) {
    const qc = useQueryClient();
    const { data } = useSessions();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!data) return;
        const stored = getSessionId();
        const valid = data.data.some((s) => String(s.id) === String(stored));
        if (!valid && data.current_id) setSessionId(data.current_id);
    }, [data]);

    useEffect(() => {
        if (!open) return;
        const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
        const esc = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    if (!data) return <span className="h-9 w-48 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />;

    const current = data.data.find((s) => s.id === data.current_id);
    const canSwitch = !data.restricted && data.data.length > 0;

    const label = (
        <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <IconSchool className="size-4.5" />
            </span>
            <span className="min-w-0 text-left leading-tight">
                <span className="block truncate text-sm font-extrabold text-slate-900">{current?.school_name || 'Belum ada sesi'}</span>
                <span className="block truncate text-[11px] font-medium text-slate-500">{current ? current.name : isAdmin ? 'Buat sesi sekolah' : 'Hubungi admin'}</span>
            </span>
        </span>
    );

    if (!canSwitch) {
        return (
            <div className="flex min-w-0 items-center gap-2">
                {current || !isAdmin ? (
                    label
                ) : (
                    <Link to="/panitia/sesi" className="flex min-w-0 items-center gap-2 rounded-xl px-1 hover:bg-slate-50">
                        {label}
                    </Link>
                )}
                {current && <Badge color={statusColor(current.status)} dot={current.status === 'open'}>{STATUS_LABEL[current.status]}</Badge>}
                {current?.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
            </div>
        );
    }

    return (
        <div ref={ref} className="relative min-w-0">
            <div className="flex min-w-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label="Pilih sesi sekolah"
                    className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-1 pr-2 pl-1 shadow-2xs transition hover:border-brand-300"
                >
                    {label}
                    <IconChevronDown className={`size-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
                </button>
                {current && (
                    <span className="hidden sm:inline-flex">
                        <Badge color={statusColor(current.status)} dot={current.status === 'open'}>
                            {STATUS_LABEL[current.status]}
                        </Badge>
                    </span>
                )}
                {current?.is_simulation && <Badge color="yellow">SIMULASI</Badge>}
            </div>

            {open && (
                <div className="absolute top-full left-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Pilih sesi sekolah</p>
                    <ul role="listbox" aria-label="Sesi sekolah" className="max-h-80 overflow-y-auto py-1">
                        {data.data.map((s) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={s.id === data.current_id}
                                    onClick={() => {
                                        setOpen(false);
                                        if (s.id !== data.current_id) switchSession(qc, s.id);
                                    }}
                                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 ${s.id === data.current_id ? 'bg-brand-50/70' : ''}`}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-slate-900">{s.school_name}</span>
                                        <span className="block truncate text-xs text-slate-500">
                                            {s.name} · {s.voters_count} pemilih
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                        <Badge color={statusColor(s.status)} dot={s.status === 'open'}>
                                            {STATUS_LABEL[s.status]}
                                        </Badge>
                                        {s.is_simulation && <span className="text-[10px] font-bold text-amber-700">SIMULASI</span>}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {isAdmin && (
                        <Link
                            to="/panitia/sesi"
                            onClick={() => setOpen(false)}
                            className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-bold text-brand-700 hover:bg-brand-50"
                        >
                            Kelola sesi sekolah →
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
