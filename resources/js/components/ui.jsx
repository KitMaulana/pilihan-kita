import { useEffect, useId, useState } from 'react';
import { create } from 'zustand';

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ label, className = '' }) {
    return (
        <div role="status" className={`flex items-center gap-3 text-slate-600 ${className}`}>
            <span className="inline-block size-6 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            {label && <span>{label}</span>}
        </div>
    );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
const BADGE = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-amber-100 text-amber-800',
    blue: 'bg-brand-100 text-brand-800',
};
export function Badge({ color = 'gray', children }) {
    return <span className={`badge ${BADGE[color]}`}>{children}</span>;
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
const ALERT = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
};
export function Alert({ type = 'info', title, children, className = '' }) {
    return (
        <div role={type === 'danger' ? 'alert' : 'status'} className={`rounded-xl border p-4 ${ALERT[type]} ${className}`}>
            {title && <p className="font-semibold">{title}</p>}
            {children && <div className={title ? 'mt-1 text-sm' : 'text-sm'}>{children}</div>}
        </div>
    );
}

/* ── Field ───────────────────────────────────────────────────────────────── */
export function Field({ label, hint, error, children }) {
    const id = useId();
    return (
        <div>
            {label && (
                <label htmlFor={id} className="label">
                    {label}
                </label>
            )}
            {typeof children === 'function' ? children(id) : children}
            {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size];
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`max-h-[92dvh] w-full ${width} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>}
                {children}
                {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
            </div>
        </div>
    );
}

/**
 * Konfirmasi ganda: pengguna harus mengetik kata kunci sebelum tombol aktif.
 */
export function TypedConfirm({ open, onClose, onConfirm, title, description, word, confirmLabel = 'Konfirmasi', danger = false, busy = false, error }) {
    const [value, setValue] = useState('');
    useEffect(() => {
        if (open) setValue('');
    }, [open]);
    const ok = value.trim().toUpperCase() === word.toUpperCase();
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button className="btn-secondary" onClick={onClose} disabled={busy}>
                        Batal
                    </button>
                    <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={!ok || busy} onClick={() => onConfirm(value)}>
                        {busy ? 'Memproses…' : confirmLabel}
                    </button>
                </>
            }
        >
            {description && <div className="mb-4 text-sm text-slate-600">{description}</div>}
            <Field label={`Ketik "${word}" untuk melanjutkan`} error={error}>
                {(id) => <input id={id} className="input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoFocus />}
            </Field>
        </Modal>
    );
}

/* ── Statistik ───────────────────────────────────────────────────────────── */
export function Stat({ label, value, sub, tone = 'default' }) {
    const tones = { default: 'text-slate-900', good: 'text-emerald-700', warn: 'text-amber-700', bad: 'text-red-700' };
    return (
        <div className="card">
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
    );
}

export function ProgressBar({ value, label, color = 'bg-brand-600' }) {
    const v = Math.max(0, Math.min(100, value || 0));
    return (
        <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
            </div>
        </div>
    );
}

export function Pagination({ meta, onPage }) {
    if (!meta || meta.last_page <= 1) return null;
    return (
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">
                Hal. {meta.current_page} dari {meta.last_page} · {meta.total} data
            </span>
            <div className="flex gap-2">
                <button className="btn-secondary btn-sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
                    ‹ Sebelumnya
                </button>
                <button className="btn-secondary btn-sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
                    Berikutnya ›
                </button>
            </div>
        </div>
    );
}

export function EmptyState({ children }) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{children}</div>;
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
const useToasts = create((set) => ({
    items: [],
    push: (t) => {
        const id = Math.random().toString(36).slice(2);
        set((s) => ({ items: [...s.items, { id, ...t }] }));
        setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), t.duration || 4000);
    },
}));

export const toast = {
    success: (message) => useToasts.getState().push({ type: 'success', message }),
    error: (message) => useToasts.getState().push({ type: 'danger', message, duration: 6000 }),
    info: (message) => useToasts.getState().push({ type: 'info', message }),
};

export function ToastHost() {
    const items = useToasts((s) => s.items);
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
            {items.map((t) => (
                <div key={t.id} className={`pointer-events-auto w-full max-w-md rounded-xl border p-3 text-sm shadow-lg ${ALERT[t.type]}`}>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
