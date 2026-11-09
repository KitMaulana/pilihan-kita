import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '../components/ui';
import RequireAuth from '../features/auth/RequireAuth';

// Publik
const HomePage = lazy(() => import('../pages/publik/HomePage'));
const HasilLangsung = lazy(() => import('../pages/publik/HasilLangsung'));
const CekResi = lazy(() => import('../pages/publik/CekResi'));
// Kiosk
const KioskPage = lazy(() => import('../pages/kiosk/KioskPage'));
const PasangPerangkat = lazy(() => import('../pages/kiosk/PasangPerangkat'));
// Panitia
const LoginPage = lazy(() => import('../pages/panitia/LoginPage'));
const PanitiaLayout = lazy(() => import('../pages/panitia/PanitiaLayout'));
const Dashboard = lazy(() => import('../pages/panitia/Dashboard'));
const Pemilih = lazy(() => import('../pages/panitia/Pemilih'));
const UnggahFoto = lazy(() => import('../pages/panitia/UnggahFoto'));
const Kandidat = lazy(() => import('../pages/panitia/Kandidat'));
const Perangkat = lazy(() => import('../pages/panitia/Perangkat'));
const Log = lazy(() => import('../pages/panitia/Log'));
const Jadwal = lazy(() => import('../pages/panitia/Jadwal'));
const UjiWajah = lazy(() => import('../pages/panitia/UjiWajah'));
const Pengguna = lazy(() => import('../pages/panitia/Pengguna'));

function Loading() {
    return (
        <div className="flex min-h-dvh items-center justify-center">
            <Spinner label="Memuat…" />
        </div>
    );
}

export default function AppRouter() {
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/hasil" element={<HasilLangsung />} />
                <Route path="/resi" element={<CekResi />} />

                <Route path="/kiosk" element={<KioskPage />} />
                <Route path="/kiosk/pasang" element={<PasangPerangkat />} />

                <Route path="/panitia/login" element={<LoginPage />} />
                <Route
                    path="/panitia"
                    element={
                        <RequireAuth>
                            <PanitiaLayout />
                        </RequireAuth>
                    }
                >
                    <Route index element={<Dashboard />} />
                    <Route path="pemilih" element={<Pemilih />} />
                    <Route path="unggah-foto" element={<UnggahFoto />} />
                    <Route path="kandidat" element={<Kandidat />} />
                    <Route path="perangkat" element={<Perangkat />} />
                    <Route path="log" element={<Log />} />
                    <Route path="jadwal" element={<Jadwal />} />
                    <Route path="uji-wajah" element={<UjiWajah />} />
                    <Route
                        path="pengguna"
                        element={
                            <RequireAuth role="admin">
                                <Pengguna />
                            </RequireAuth>
                        }
                    />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}
