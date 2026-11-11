import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import {
    IconArrowRight,
    IconChartBar,
    IconCheckCircle,
    IconFaceScan,
    IconLock,
    IconShieldCheck,
    IconSchool,
    IconSparkles,
    IconTicket,
    IconUserCheck,
    IconVoteBox,
} from '../../components/Icons';
import PublicShell from './PublicShell';
import { usePublicSessions } from './HasilLangsung';

const STEPS = [
    {
        num: '01',
        title: 'Scan wajah di meja check-in',
        desc: 'Berdiri di depan tablet kamera, ikuti instruksi berkedip atau menoleh sebentar. Kurang dari 3 detik!',
        Icon: IconFaceScan,
        accent: 'from-brand-600 to-brand-500',
        pill: 'bg-brand-50 text-brand-700',
    },
    {
        num: '02',
        title: 'Pastikan nama & kelas Anda',
        desc: 'Tekan “Ya, ini saya” jika sudah tepat. Tidak pakai wajah? Gunakan NISN / NIP + tanggal lahir.',
        Icon: IconUserCheck,
        accent: 'from-crimson-600 to-crimson-500',
        pill: 'bg-crimson-50 text-crimson-700',
    },
    {
        num: '03',
        title: 'Masuk bilik & simpan kode resi',
        desc: 'Pilih kandidat di bilik suara yang terpisah & anonim, lalu foto kode resi untuk cek keabsahan di ledger.',
        Icon: IconVoteBox,
        accent: 'from-emerald-600 to-emerald-500',
        pill: 'bg-emerald-50 text-emerald-700',
    },
];

const PRIVACY_ITEMS = [
    {
        title: 'Hanya vektor angka, tanpa foto',
        desc: 'Pas foto diubah menjadi vektor numerik di browser lalu fotonya dihapus. Tidak ada foto wajah tersimpan di server.',
    },
    {
        title: 'Kamera tablet tidak mengirim gambar',
        desc: 'Seluruh deteksi dan ekstraksi fitur berjalan lokal di tablet. Hanya vektor sementara yang dicocokkan ke server sekolah.',
    },
    {
        title: 'Bilik suara terpisah & 100% rahasia',
        desc: 'Perangkat check-in dan bilik suara terpisah. Tabel suara memakai UUID acak tanpa identitas pemilih maupun waktu presisi.',
    },
    {
        title: 'Jalur alternatif inklusif & dihapus pasca-acara',
        desc: 'Pemilih tetap bebas memilih lewat NISN/NIP + tanggal lahir tanpa stigma. Semua template wajah dihapus setelah hasil final.',
    },
];

/** Sekolah yang pemilihannya sedang/sudah berjalan — tautan ke hasil masing-masing. */
function SchoolsSection() {
    const { data } = usePublicSessions();
    if (!data?.length) return null;
    return (
        <section className="mt-10" aria-labelledby="schools-title">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <h2 id="schools-title" className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Sekolah peserta</h2>
                    <p className="text-sm text-slate-500">Pilih sekolah untuk melihat hitung langsung.</p>
                </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((s) => (
                    <li key={s.slug}>
                        <Link to={`/hasil/${s.slug}`} className="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                <IconSchool className="size-5.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-extrabold text-slate-900">{s.school_name}</span>
                                <span className="block truncate text-xs text-slate-500">
                                    {s.is_voting_open ? 'Sedang berlangsung' : s.status === 'published' ? 'Hasil akhir' : 'Ditutup'}
                                    {s.is_simulation ? ' · simulasi' : ''}
                                </span>
                            </span>
                            {s.is_voting_open && <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />}
                            <IconArrowRight className="size-4 shrink-0 text-brand-700 transition group-hover:translate-x-0.5" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function HomePage() {
    return (
        <PublicShell>
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-6 text-white shadow-2xl sm:p-10 lg:p-12">
                <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
                <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-crimson-600/25 blur-3xl" aria-hidden="true" />

                <div className="relative grid items-center gap-8 lg:grid-cols-12">
                    <div className="lg:col-span-7">
                        <div className="inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                            <BrandLogo variant="full" size="xs" surface="pill" />
                            <span className="text-xs font-bold tracking-wider text-brand-100 uppercase">
                                E-Voting OSIS
                            </span>
                        </div>

                        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
                            One Face,{' '}
                            <span className="bg-gradient-to-r from-white via-brand-200 to-crimson-200 bg-clip-text text-transparent">
                                One Vote.
                            </span>
                        </h1>
                        <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-100/95 sm:text-base">
                            Pemilihan Ketua OSIS era digital yang cepat, transparan, dan tetap rahasia. Cukup check-in wajah di tablet, konfirmasi nama &amp; kelas, lalu salurkan pilihanmu di bilik suara anonim.
                        </p>

                        <div className="mt-7 flex flex-wrap gap-3">
                            <Link
                                to="/hasil"
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-lg transition hover:bg-brand-50 active:scale-[0.99] sm:text-base"
                            >
                                <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                                Lihat Hitung Langsung
                                <IconArrowRight className="size-4" />
                            </Link>
                            <Link
                                to="/resi"
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-white/20 sm:text-base"
                            >
                                <IconTicket className="size-4" />
                                Cek Kode Resi
                            </Link>
                        </div>
                    </div>

                    {/* Visual Trust Bento inside Hero */}
                    <div className="grid gap-3 lg:col-span-5">
                        {[
                            {
                                Icon: IconFaceScan,
                                label: 'Biometrik Di Browser',
                                sub: 'Pengenalan wajah 1:N & liveness anti-foto langsung di tablet.',
                                badge: 'Lokal',
                                color: 'text-brand-300 bg-brand-500/20',
                            },
                            {
                                Icon: IconShieldCheck,
                                label: 'Anonimitas Terjamin',
                                sub: 'Meja check-in & bilik suara terpisah — identitas tidak menyentuh surat suara.',
                                badge: 'Rahasia',
                                color: 'text-emerald-300 bg-emerald-500/20',
                            },
                            {
                                Icon: IconChartBar,
                                label: 'Hitung Langsung & Ledger',
                                sub: 'Real count transparan tiap 5 detik + verifikasi resi rantai hash SHA-256.',
                                badge: 'Real Count',
                                color: 'text-crimson-200 bg-crimson-500/20',
                            },
                        ].map((item) => {
                            const Ico = item.Icon;
                            return (
                                <div
                                    key={item.label}
                                    className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md transition hover:bg-white/15"
                                >
                                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                                        <Ico className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-bold text-white">{item.label}</p>
                                            <span className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-100">
                                                {item.badge}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-relaxed text-brand-100/90">{item.sub}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <SchoolsSection />

            {/* Alur 3 Langkah */}
            <section className="mt-8 sm:mt-10">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand-700 uppercase">
                            <IconSparkles className="size-3.5 text-crimson-600" /> Alur Pemungutan Suara
                        </span>
                        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                            3 Langkah Cepat di Hari-H
                        </h2>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {STEPS.map((s) => {
                        const Ico = s.Icon;
                        return (
                            <article key={s.num} className="card relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent}`} aria-hidden="true" />
                                <div className="flex items-center justify-between">
                                    <div className={`flex size-11 items-center justify-center rounded-2xl ${s.pill}`}>
                                        <Ico className="size-5" />
                                    </div>
                                    <span className="font-mono text-2xl font-black text-slate-200">{s.num}</span>
                                </div>
                                <h3 className="mt-4 text-base font-extrabold tracking-tight text-slate-900">{s.title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            {/* Privasi & Keamanan */}
            <section className="card mt-8 overflow-hidden p-0 sm:mt-10 sm:p-0">
                <div className="grid lg:grid-cols-12">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50 via-white to-crimson-50/40 p-6 lg:col-span-4 lg:border-r lg:border-b-0 lg:p-8">
                        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-900 text-white shadow-sm">
                            <IconShieldCheck className="size-6" />
                        </div>
                        <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">
                            Privasi Data Wajah &amp; Kerahasiaan Suara
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            Dirancang mengikuti prinsip minimalisasi data biometrik agar seluruh warga sekolah merasa aman dan nyaman.
                        </p>
                    </div>
                    <div className="grid gap-4 p-6 sm:grid-cols-2 lg:col-span-8 lg:p-8">
                        {PRIVACY_ITEMS.map((item) => (
                            <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                                <IconCheckCircle className="mt-0.5 size-5 text-emerald-600" />
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Portal Panitia CTA */}
            <section className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-xs sm:flex-row">
                <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="hidden size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 sm:flex">
                        <IconLock className="size-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900">Panitia &amp; Pengawas Pemilihan</p>
                        <p className="text-xs text-slate-500">Kelola pemilih, daftarkan tablet, dan pantau integritas pemilihan.</p>
                    </div>
                </div>
                <Link to="/panitia/login" className="btn-secondary w-full sm:w-auto">
                    <IconLock className="size-4" />
                    Masuk Panel Panitia
                </Link>
            </section>
        </PublicShell>
    );
}
