// Waktu disimpan UTC di server, selalu ditampilkan dalam Asia/Jakarta (WIB).
const TZ = 'Asia/Jakarta';

export function formatDateTime(iso, opts = {}) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: TZ,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...opts,
    }).format(new Date(iso)) + ' WIB';
}

export function formatTime(iso, withSeconds = true) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: withSeconds ? '2-digit' : undefined,
        hour12: false,
    })
        .format(new Date(iso))
        .replace(/\./g, ':');
}

/** ISO UTC → nilai input datetime-local dalam WIB ("2026-11-20T07:00"). */
export function toWibInput(iso) {
    if (!iso) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date(iso));
    const g = (t) => parts.find((p) => p.type === t)?.value;
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}

/** Nilai datetime-local (dianggap WIB) → ISO dengan offset +07:00. */
export function fromWibInput(value) {
    return value ? `${value}:00+07:00` : null;
}

export function percent(part, total) {
    if (!total) return 0;
    return Math.round((part * 1000) / total) / 10;
}

export const number = (n) => new Intl.NumberFormat('id-ID').format(n ?? 0);

export const STATUS_LABEL = {
    draft: 'Draf',
    open: 'Dibuka',
    closed: 'Ditutup',
    published: 'Dipublikasikan',
};

export const RESULT_LABEL = {
    matched: 'Dikenali',
    not_matched: 'Tidak dikenali',
    ambiguous: 'Ambigu',
    already_voted: 'Sudah memilih',
    locked: 'Terkunci',
    liveness_failed: 'Liveness gagal',
    rejected: 'Ditolak',
    wrong_data: 'Data salah',
};
