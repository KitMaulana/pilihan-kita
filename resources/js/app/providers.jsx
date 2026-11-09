import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ToastHost } from '../components/ui';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error) => count < 2 && (!error?.response || error.response.status >= 500),
            refetchOnWindowFocus: false,
            staleTime: 10_000,
        },
    },
});

export default function Providers({ children }) {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {children}
                <ToastHost />
            </BrowserRouter>
        </QueryClientProvider>
    );
}
