import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { useAuth } from './useAuth';

export default function RequireAuth({ children, role }) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center">
                <Spinner label="Memeriksa sesi…" />
            </div>
        );
    }
    if (!user) return <Navigate to="/panitia/login" replace state={{ from: location.pathname }} />;
    if (role && user.role !== role) {
        return <div className="card m-4 text-center text-slate-600">Halaman ini khusus {role}.</div>;
    }
    return children;
}
