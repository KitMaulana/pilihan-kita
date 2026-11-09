import { Link } from 'react-router-dom';
import PublicShell from './PublicShell';

export default function HomePage() {
    return (
        <PublicShell>
            <section className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-lg sm:p-10">
                <p className="text-sm font-semibold tracking-wide text-accent-400 uppercase">Pemilihan Ketua OSIS</p>
                <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">One Face One Vote</h1>
                <p className="mt-3 max-w-2xl text-brand-100">
                    Satu orang, satu suara. Pemilih dikenali lewat wajah di tablet pemungutan, memastikan nama &amp; kelas, lalu memilih. Suara Anda rahasia — sistem tidak
                    menyimpan siapa memilih siapa.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/hasil" className="btn bg-white text-brand-800 hover:bg-brand-50">
                        Lihat Hitung Langsung
                    </Link>
                    <Link to="/resi" className="btn border border-white/40 text-white hover:bg-white/10">
                        Cek Kode Resi
                    </Link>
                </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                    ['1. Berdiri di depan tablet', 'Kamera mengenali wajah Anda. Ikuti instruksi berkedip/menoleh.'],
                    ['2. Pastikan nama & kelas', 'Tekan “Ya, ini saya” bila benar. Bila tidak, gunakan NISN/NIP + tanggal lahir.'],
                    ['3. Pilih kandidat', 'Sentuh kandidat pilihan Anda, lalu simpan kode resi yang muncul.'],
                ].map(([t, d]) => (
                    <div key={t} className="card">
                        <h2 className="font-bold text-slate-900">{t}</h2>
                        <p className="mt-1 text-sm text-slate-600">{d}</p>
                    </div>
                ))}
            </section>

            <section className="card mt-6 text-sm text-slate-600">
                <h2 className="mb-2 font-bold text-slate-900">Privasi data wajah</h2>
                <ul className="list-disc space-y-1 pl-5">
                    <li>Foto pas diubah menjadi deretan angka (vektor) lalu fotonya dihapus.</li>
                    <li>Tablet tidak menyimpan dan tidak mengirim gambar wajah — hanya vektor ke server sekolah.</li>
                    <li>Semua data wajah dihapus setelah hasil akhir ditetapkan.</li>
                    <li>Tidak bersedia memakai wajah? Gunakan jalur NISN/NIP + tanggal lahir di tablet yang sama.</li>
                </ul>
            </section>

            <p className="mt-6 text-center text-sm">
                <Link to="/panitia/login" className="text-brand-700 underline">
                    Masuk panitia
                </Link>
            </p>
        </PublicShell>
    );
}
