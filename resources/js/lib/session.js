// Sesi (sekolah) yang sedang dikelola di panel panitia. Disimpan per peramban;
// dikirim ke server lewat header X-Session-Id (lihat lib/api.js). Server tetap
// yang menentukan: panitia yang dibatasi selalu memakai sesinya sendiri.
const KEY = 'pk_session_id';

export function getSessionId() {
    try {
        const v = localStorage.getItem(KEY);
        return v && /^\d+$/.test(v) ? v : null;
    } catch {
        return null;
    }
}

export function setSessionId(id) {
    try {
        id ? localStorage.setItem(KEY, String(id)) : localStorage.removeItem(KEY);
    } catch {
        /* penyimpanan diblokir — tetap jalan dengan sesi bawaan server */
    }
}
