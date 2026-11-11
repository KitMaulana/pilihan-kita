import { useEffect, useId, useState } from 'react';
import { create } from 'zustand';
import { IconAlertTriangle, IconCheckCircle, IconClose, IconInfoCircle } from './Icons';

/* ── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ label, className = '' }) {
    return (
        <div role="status" className={`flex items-center gap-3 text-slate-600 ${className}`}>
            <span className="relative inline-flex size-7 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
                <span className="size-2 rounded-full bg-crimson-500" />
            </span>
            {label && <span className="text-sm font-medium">{label}</span>}
        </div>
    );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
const BADGE = {
    gray: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    red: 'bg-crimson-50 text-crimson-700 ring-1 ring-crimson-200',
    yellow: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    blue: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
};
export function Badge({ color = 'gray', dot = false, children }) {
    const dotColor = {
        gray: 'bg-slate-400',
        green: 'bg-emerald-500',
        red: 'bg-crimson-500',
        yellow: 'bg-amber-500',
        blue: 'bg-brand-500',
    }[color];
    return (
        <span className={`badge ${BADGE[color] || BADGE.gray}`}>
            {dot && <span className={`size-1.5 rounded-full ${dotColor}`} aria-hidden="true" />}
            {children}
        </span>
    );
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
const ALERT = {
    info: {
        box: 'border-brand-200/90 bg-brand-50/80 text-brand-900',
        icon: 'text-brand-600',
        Icon: IconInfoCircle,
    },
    success: {
        box: 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950',
        icon: 'text-emerald-600',
        Icon: IconCheckCircle,
    },
    warning: {
        box: 'border-amber-200/90 bg-amber-50/90 text-amber-950',
        icon: 'text-amber-600',
        Icon: IconAlertTriangle,
    },
    danger: {
        box: 'border-crimson-200/90 bg-crimson-50/90 text-crimson-950',
        icon: 'text-crimson-600',
        Icon: IconAlertTriangle,
    },
};

export function Alert({ type = 'info', title, children, className = '' }) {
    const cfg = ALERT[type] || ALERT.info;
    const Ico = cfg.Icon;
    return (
        <div role={type === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl border p-4 ${cfg.box} ${className}`}>
            <Ico className={`mt-0.5 size-5 ${cfg.icon}`} />
            <div className="min-w-0 flex-1">
                {title && <p className="font-bold tracking-tight">{title}</p>}
                {children && <div className={title ? 'mt-1 text-sm leading-relaxed' : 'text-sm leading-relaxed'}>{children}</div>}
            </div>
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
            {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
            {error && <p className="mt-1.5 text-sm font-medium text-crimson-600">{error}</p>}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/60 p-0 backdrop-blur-xs sm:items-center sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`max-h-[92dvh] w-full ${width} overflow-y-auto rounded-t-3xl border border-slate-200/80 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
                        {onClose && (
                            <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup">
                                <IconClose className="size-5" />
                            </button>
                        )}
                    </div>
                )}
                {children}
                {footer && <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">{footer}</div>}
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
            {description && <div className="mb-4 text-sm leading-relaxed text-slate-600">{description}</div>}
            <Field label={`Ketik "${word}" untuk melanjutkan`} error={error}>
                {(id) => <input id={id} className="input font-mono" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoFocus />}
            </Field>
        </Modal>
    );
}

/* ── Statistik ───────────────────────────────────────────────────────────── */
export function Stat({ label, value, sub, tone = 'default', icon = null }) {
    const tones = {
        default: { val: 'text-slate-900', pill: 'bg-slate-100 text-slate-600', bar: 'from-brand-500 to-brand-600' },
        good: { val: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-500 to-emerald-600' },
        warn: { val: 'text-amber-700', pill: 'bg-amber-50 text-amber-600', bar: 'from-amber-400 to-amber-500' },
        bad: { val: 'text-crimson-700', pill: 'bg-crimson-50 text-crimson-600', bar: 'from-crimson-500 to-crimson-600' },
    }[tone];
    return (
        <div className="card relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tones.bar}`} aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{label}</p>
                    <p className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl ${tones.val}`}>{value}</p>
                </div>
                {icon && <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tones.pill}`}>{icon}</div>}
            </div>
            {sub && <p className="mt-2 text-xs font-medium text-slate-500">{sub}</p>}
        </div>
    );
}

export function ProgressBar({ value, label, color = 'bg-gradient-to-r from-brand-700 to-brand-500' }) {
    const v = Math.max(0, Math.min(100, value || 0));
    return (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
            <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${v}%` }} />
        </div>
    );
}

export function Pagination({ meta, onPage }) {
    if (!meta || !meta.last_page || meta.last_page <= 1) return null;
    return (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500">
                Halaman <strong className="text-slate-800">{meta.current_page}</strong> dari <strong className="text-slate-800">{meta.last_page}</strong> · {meta.total} data
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
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center text-sm font-medium text-slate-500">
            {children}
        </div>
    );
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
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
            {items.map((t) => {
                const cfg = ALERT[t.type] || ALERT.info;
                const Ico = cfg.Icon;
                return (
                    <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-md ${cfg.box}`}>
                        <Ico className={`size-5 ${cfg.icon}`} />
                        <span className="min-w-0 flex-1">{t.message}</span>
                    </div>
                );
            })}
        </div>
    );
}
