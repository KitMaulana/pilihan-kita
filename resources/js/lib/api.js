import axios from 'axios';
import { getDeviceToken } from './device';
import { getSessionId, setSessionId } from './session';

/**
 * Klien API.
 *  - `api`   : panel panitia & publik (cookie sesi Sanctum + XSRF otomatis).
 *  - `kiosk` : tablet (header X-Device-Token).
 */
function create() {
    const instance = axios.create({
        baseURL: '/api/v1',
        withCredentials: true,
        withXSRFToken: true,
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
        timeout: 20000,
    });
    return instance;
}

export const api = create();
export const kiosk = create();

// Panel panitia: sesi (sekolah) yang sedang dipilih.
api.interceptors.request.use((config) => {
    const session = getSessionId();
    if (session && String(config.url || '').startsWith('/panitia') && !config.headers['X-Session-Id']) config.headers['X-Session-Id'] = session;
    return config;
});

// Sesi tersimpan milik sekolah lain (mis. peramban bekas admin) → lupakan & ulangi sekali dengan sesi akun sendiri.
api.interceptors.response.use(undefined, (error) => {
    if (error.response?.status === 403 && error.response.data?.code === 'session_forbidden' && !error.config.__sessionRetried) {
        setSessionId(null);
        error.config.__sessionRetried = true;
        delete error.config.headers['X-Session-Id'];
        return api(error.config);
    }
    return Promise.reject(error);
});

kiosk.interceptors.request.use((config) => {
    if (config.headers['X-Device-Token']) return config; // diberikan eksplisit (uji token saat pemasangan)
    const token = getDeviceToken();
    if (token) config.headers['X-Device-Token'] = token;
    return config;
});

let csrfReady = null;
/** Ambil cookie XSRF sekali sebelum permintaan yang mengubah data. */
export function ensureCsrf() {
    csrfReady ??= axios.get('/sanctum/csrf-cookie', { withCredentials: true }).catch((e) => {
        csrfReady = null;
        throw e;
    });
    return csrfReady;
}

for (const instance of [api, kiosk]) {
    instance.interceptors.request.use(async (config) => {
        if (config.method && config.method.toLowerCase() !== 'get') await ensureCsrf();
        return config;
    });
    instance.interceptors.response.use(undefined, async (error) => {
        // Token CSRF kedaluwarsa (419) → ambil ulang sekali lalu ulangi.
        if (error.response?.status === 419 && !error.config.__retried) {
            csrfReady = null;
            await ensureCsrf();
            error.config.__retried = true;
            return instance(error.config);
        }
        return Promise.reject(error);
    });
}

/** Pesan galat ramah dalam Bahasa Indonesia. */
export function errorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
    if (!error) return fallback;
    if (error.code === 'ECONNABORTED') return 'Koneksi lambat atau terputus. Silakan coba lagi.';
    if (!error.response) return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
    const data = error.response.data || {};
    if (data.errors) {
        const first = Object.values(data.errors)[0];
        if (Array.isArray(first) && first[0]) return first[0];
    }
    if (error.response.status === 429) return data.message || 'Terlalu banyak permintaan. Tunggu sebentar.';
    if (error.response.status === 403 && !data.message) return 'Anda tidak memiliki akses.';
    return data.message || fallback;
}

export function errorCode(error) {
    if (!error?.response) return 'network';
    return error.response.data?.code || `http_${error.response.status}`;
}
