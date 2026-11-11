import { create } from 'zustand';

/**
 * State satu sesi pemilih di MEJA CHECK-IN. Direset penuh setelah selesai/batal
 * agar tidak ada sisa data pemilih sebelumnya di tablet.
 *
 * step: scan | confirm | done | fallback | message
 */
const initial = {
    step: 'scan',
    identity: null, // { ticket, name, class_name, method, expiresAt }
    checkin: null, // { name, message, expiresIn } — ditampilkan sesaat di layar "check-in berhasil"
    message: null, // { tone, title, text, actions: ['retry','fallback','home'] }
    faceFailures: 0,
};

export const useKiosk = create((set, get) => ({
    ...initial,

    reset: () => set({ ...initial }),

    identified: (data, method) =>
        set({
            step: 'confirm',
            identity: {
                ticket: data.ticket,
                name: data.name,
                class_name: data.class_name,
                method,
                expiresAt: Date.now() + data.expires_in * 1000,
            },
            message: null,
        }),

    checkedIn: (data) =>
        set({
            step: 'done',
            checkin: { name: get().identity?.name, message: data.message, expiresIn: data.expires_in },
            identity: null,
        }),

    goFallback: () => set({ step: 'fallback', message: null }),

    showMessage: (message) => set({ step: 'message', message }),

    faceFailed: () => set((s) => ({ faceFailures: s.faceFailures + 1 })),
}));
