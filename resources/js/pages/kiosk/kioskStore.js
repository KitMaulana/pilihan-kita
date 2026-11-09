import { create } from 'zustand';
import { uuid } from '../../lib/device';

/**
 * State satu sesi pemilih di kiosk. Direset penuh setelah selesai/batal
 * agar tidak ada sisa data pemilih sebelumnya di tablet.
 *
 * step: boot | scan | confirm | choose | done | fallback | message
 */
const initial = {
    step: 'scan',
    identity: null, // { ticket, name, class_name, method, expiresAt }
    vote: null, // { token, expiresAt, idempotencyKey }
    receipt: null,
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

    confirmed: (data) =>
        set({
            step: 'choose',
            vote: { token: data.vote_token, expiresAt: Date.now() + data.expires_in * 1000, idempotencyKey: uuid() },
            identity: { ...get().identity, ticket: null },
        }),

    done: (receipt) => set({ step: 'done', receipt, vote: null, identity: null }),

    goFallback: () => set({ step: 'fallback', message: null }),

    showMessage: (message) => set({ step: 'message', message }),

    faceFailed: () => set((s) => ({ faceFailures: s.faceFailures + 1 })),
}));
