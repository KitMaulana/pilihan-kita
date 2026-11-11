import { Link, Navigate, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { Spinner } from '../../components/ui';
import { useAuth } from './useAuth';

export default function RequireAuth({ children, role }) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="bg-light-grid flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
                <BrandLogo size="md" surface="card" />
                <Spinner label="Memeriksa sesi…" />
            </div>
        );
    }
    if (!user) return <Navigate to="/panitia/login" replace state={{ from: location.pathname }} />;
    if (role && user.role !== role) {
        return (
            <div className="bg-light-grid flex min-h-dvh items-center justify-center p-4">
                <div className="card max-w-md space-y-4 text-center">
                    <BrandLogo size="sm" className="mx-auto" />
                    <p className="text-slate-600">Halaman ini khusus peran {role}.</p>
                    <Link to="/panitia" className="btn-secondary w-full">
                        Kembali ke Dasbor
                    </Link>
                </div>
            </div>
        );
    }
    return children;
}
