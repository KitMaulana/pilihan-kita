import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useAuth() {
    const qc = useQueryClient();
    const query = useQuery({
        queryKey: ['me'],
        queryFn: () =>
            api.get('/auth/me').then((r) => r.data.user ?? null),
        staleTime: 5 * 60_000,
        retry: false,
    });

    return {
        user: query.data ?? null,
        isLoading: query.isLoading,
        isAdmin: query.data?.role === 'admin',
        async login(login, password) {
            const { data } = await api.post('/auth/login', { login, password, remember: true });
            qc.setQueryData(['me'], data.user);
            return data.user;
        },
        async logout() {
            await api.post('/auth/logout').catch(() => {});
            qc.clear();
            qc.setQueryData(['me'], null);
        },
    };
}
