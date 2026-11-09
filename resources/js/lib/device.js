// Token perangkat kiosk disimpan di localStorage tablet (diisi lewat halaman /kiosk/pasang).
const KEY = 'pk_device_token';

function safe(fn, fallback = null) {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export function getDeviceToken() {
    return safe(() => localStorage.getItem(KEY));
}

export function setDeviceToken(token) {
    safe(() => localStorage.setItem(KEY, token));
}

export function clearDeviceToken() {
    safe(() => localStorage.removeItem(KEY));
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
