// Token perangkat disimpan di localStorage (diisi lewat halaman /kiosk/pasang).
// Satu peramban dapat menyimpan SATU token per peran: meja check-in (/kiosk) dan bilik suara (/bilik),
// sehingga keduanya bisa dicoba di peramban yang sama (tab berbeda) tanpa saling menimpa.
const KEYS = { checkin: 'pk_device_token_checkin', booth: 'pk_device_token_booth' };
const LEGACY = 'pk_device_token'; // versi lama: satu token tanpa peran

function safe(fn, fallback = null) {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

/** Peran yang dipakai halaman saat ini: /bilik → booth, selain itu → checkin. */
export function currentRole() {
    return typeof location !== 'undefined' && location.pathname.startsWith('/bilik') ? 'booth' : 'checkin';
}

export function getDeviceToken(role = currentRole()) {
    return safe(() => localStorage.getItem(KEYS[role] || KEYS.checkin) || localStorage.getItem(LEGACY));
}

export function setDeviceToken(token, role = 'checkin') {
    safe(() => {
        localStorage.setItem(KEYS[role] || KEYS.checkin, token);
        localStorage.removeItem(LEGACY); // token lama diganti
    });
}

export function clearDeviceToken(role) {
    safe(() => {
        for (const r of role ? [role] : Object.keys(KEYS)) localStorage.removeItem(KEYS[r]);
        if (!role) localStorage.removeItem(LEGACY);
    });
}

/** Peran yang sudah terpasang di peramban ini: { checkin: bool, booth: bool }. */
export function pairedRoles() {
    return safe(() => ({ checkin: !!localStorage.getItem(KEYS.checkin), booth: !!localStorage.getItem(KEYS.booth), legacy: !!localStorage.getItem(LEGACY) }), { checkin: false, booth: false, legacy: false });
}

/** UUIDv4 untuk idempotency key. */
export function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
