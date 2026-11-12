import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import { number } from '../lib/format';
import { TypedConfirm, toast } from './ui';
import { switchSession } from './SessionSwitcher';

/**
 * Hapus satu sesi (sekolah) beserta SELURUH datanya. Permintaan membawa X-Session-Id sesi yang dipilih
 * sendiri, jadi aman dipakai dari kartu mana pun (tidak harus sesi yang sedang dikelola).
 * Konfirmasi: ketik "HAPUS {NAMA SEKOLAH}" (frasa dari server).
 */
export default function DeleteSessionDialog({ session, onClose, onDeleted }) {
    const qc = useQueryClient();
    const [error, setError] = useState(null);
    const m = useMutation({
        mutationFn: (confirm) => api.delete('/panitia/election', { data: { confirm }, headers: { 'X-Session-Id': String(session.id) } }),
        onSuccess: ({ data }) => {
            toast.success(data.message);
            setError(null);
            switchSession(qc, null); // pindah ke sesi lain yang masih ada (server memilih yang terbaru)
            onDeleted?.();
        },
        onError: (e) => setError(errorMessage(e)),
    });

    const items = [
        [session.voters_count, 'pemilih (beserta data wajahnya)'],
        [session.votes_count, 'suara & ledger'],
        [session.candidates_count, 'kandidat (beserta fotonya)'],
        [session.devices_count, 'perangkat check-in / bilik'],
    ];

    return (
        <TypedConfirm
            open
            onClose={() => {
                setError(null);
                onClose();
            }}
            onConfirm={(v) => m.mutate(v)}
            title={`Hapus sesi ${session.school_name}`}
            word={session.delete_phrase}
            confirmLabel="Hapus permanen"
            danger
            busy={m.isPending}
            error={error}
            description={
                <div className="space-y-3">
                    <p>
                        Seluruh data <b>{session.school_name}</b> akan dihapus <b>permanen</b> dan tidak dapat dikembalikan:
                    </p>
                    <ul className="grid gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-3 text-slate-700">
                        {items.map(([n, label]) => (
                            <li key={label} className="flex items-baseline gap-2">
                                <span className="w-12 shrink-0 text-right font-mono font-bold text-red-700 tabular-nums">{number(n ?? 0)}</span>
                                <span>{label}</span>
                            </li>
                        ))}
                        <li className="flex items-baseline gap-2">
                            <span className="w-12 shrink-0 text-right font-mono font-bold text-red-700">+</span>
                            <span>log percobaan akses, log aktivitas sesi, dan tautan hasil publik</span>
                        </li>
                    </ul>
                    <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
                        <b>Unduh laporan PDF hasil dulu</b> (Jadwal &amp; Status → Unduh PDF) bila hasilnya masih diperlukan. Sekolah lain tidak terpengaruh. Akun panitia sekolah ini tidak dihapus, tetapi
                        dilepas dari sekolah dan terkunci sampai ditugaskan ulang.
                    </p>
                </div>
            }
        />
    );
}
