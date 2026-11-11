import { useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { number } from '../../lib/format';
import { useAuth } from '../../features/auth/useAuth';
import { IconUpload, IconUsers } from '../../components/Icons';
import { Alert, Badge, EmptyState, Field, Modal, Pagination, Spinner, toast } from '../../components/ui';

function ImportPanel({ onDone }) {
    const [type, setType] = useState('student');
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [showAll, setShowAll] = useState(false);

    async function doPreview(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setPreview(null);
        try {
            const fd = new FormData();
            fd.append('type', type);
            fd.append('file', file);
            const { data } = await api.post('/panitia/voters/import/preview', fd);
            setPreview(data);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    async function commit() {
        setBusy(true);
        try {
            const { data } = await api.post('/panitia/voters/import/commit', { token: preview.token });
            toast.success(data.message);
            setPreview(null);
            setFile(null);
            onDone();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    const rows = preview ? (showAll ? preview.ready : preview.ready.slice(0, 20)) : [];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <IconUpload className="size-5 text-brand-700" />
                <h2 className="text-base font-extrabold text-slate-900">Impor Data Pemilih (CSV)</h2>
            </div>
            <form onSubmit={doPreview} className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                <Field label="Jenis">
                    {(id) => (
                        <select id={id} className="input" value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="student">Siswa (nisn,nama,kelas,tanggal_lahir)</option>
                            <option value="teacher">Guru (nip,nama,tanggal_lahir,kode)</option>
                        </select>
                    )}
                </Field>
                <Field label="Berkas CSV (maks. 2.000 baris)">
                    {(id) => <input id={id} type="file" accept=".csv,text/csv" className="input py-2" onChange={(e) => setFile(e.target.files[0] || null)} required />}
                </Field>
                <button className="btn-primary" disabled={!file || busy}>
                    {busy && !preview ? 'Membaca…' : 'Pratinjau'}
                </button>
            </form>
            <p className="text-xs text-slate-500">
                Unduh templat:{' '}
                <a className="font-semibold text-brand-700 underline" href="/api/v1/panitia/voters/template/student">
                    siswa
                </a>{' '}
                ·{' '}
                <a className="font-semibold text-brand-700 underline" href="/api/v1/panitia/voters/template/teacher">
                    guru
                </a>
                . Tanggal: YYYY-MM-DD atau DD/MM/YYYY. Di Excel, format kolom NISN/NIP sebagai <em>Teks</em> agar nol di depan tidak hilang.
            </p>
            {error && <Alert type="danger">{error}</Alert>}

            {preview && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Badge color="blue">Total {preview.summary.total}</Badge>
                        <Badge color="green">Siap {preview.summary.ready}</Badge>
                        <Badge color="gray">Baru {preview.summary.new}</Badge>
                        <Badge color="gray">Diperbarui {preview.summary.update}</Badge>
                        <Badge color={preview.summary.problems ? 'red' : 'gray'}>Bermasalah {preview.summary.problems}</Badge>
                    </div>

                    {preview.problems.length > 0 && (
                        <div>
                            <h3 className="mb-2 text-sm font-bold text-crimson-700">Baris bermasalah (tidak akan diimpor)</h3>
                            <div className="table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Baris</th>
                                            <th>Nomor induk</th>
                                            <th>Nama</th>
                                            <th>Alasan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.problems.map((p, i) => (
                                            <tr key={i} className="bg-crimson-50/40">
                                                <td>{p.line}</td>
                                                <td className="font-mono text-xs">{p.identifier || p.raw?.nisn || p.raw?.nip || '—'}</td>
                                                <td>{p.name || '—'}</td>
                                                <td className="text-xs text-crimson-700">{p.errors.join('; ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="mb-2 text-sm font-bold text-emerald-700">Baris siap</h3>
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Baris</th>
                                        <th>Nomor induk</th>
                                        <th>Nama</th>
                                        <th>Kelas/Kode</th>
                                        <th>Tgl lahir</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.line}>
                                            <td>{r.line}</td>
                                            <td className="font-mono text-xs">{r.identifier || '—'}</td>
                                            <td className="font-medium">{r.name}</td>
                                            <td>{r.class_name || r.distinguisher || '—'}</td>
                                            <td className="font-mono text-xs">{r.birth_date}</td>
                                            <td>{r.action === 'baru' ? <Badge color="green">baru</Badge> : <Badge color="yellow">perbarui</Badge>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {preview.ready.length > 20 && (
                            <button className="btn-ghost btn-sm mt-2" onClick={() => setShowAll(!showAll)}>
                                {showAll ? 'Ringkas' : `Tampilkan semua (${preview.ready.length})`}
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button className="btn-secondary" onClick={() => setPreview(null)} disabled={busy}>
                            Batal
                        </button>
                        <button className="btn-primary" onClick={commit} disabled={busy || preview.summary.ready === 0}>
                            {busy ? 'Menyimpan…' : `Impor ${preview.summary.ready} baris siap`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditVoter({ voter, onClose }) {
    const qc = useQueryClient();
    const { isAdmin } = useAuth();
    const [form, setForm] = useState({
        name: voter.name,
        class_name: voter.class_name || '',
        birth_date: voter.birth_date,
        distinguisher: voter.distinguisher || '',
        is_active: voter.is_active,
    });
    const [error, setError] = useState(null);

    const save = useMutation({
        mutationFn: () => api.patch(`/panitia/voters/${voter.id}`, { ...form, class_name: form.class_name || null, distinguisher: form.distinguisher || null }),
        onSuccess: () => {
            toast.success('Data pemilih disimpan.');
            qc.invalidateQueries({ queryKey: ['voters'] });
            onClose();
        },
        onError: (e) => setError(errorMessage(e)),
    });
    const removeFace = useMutation({
        mutationFn: () => api.delete(`/panitia/face-templates/${voter.id}`),
        onSuccess: () => {
            toast.success('Template wajah dihapus.');
            qc.invalidateQueries({ queryKey: ['voters'] });
            onClose();
        },
        onError: (e) => setError(errorMessage(e)),
    });

    return (
        <Modal
            open
            onClose={onClose}
            title={`Ubah: ${voter.name}`}
            footer={
                <>
                    {isAdmin && voter.face?.registered && (
                        <button className="btn-danger mr-auto" onClick={() => confirm('Hapus template wajah pemilih ini?') && removeFace.mutate()}>
                            Hapus wajah
                        </button>
                    )}
                    <button className="btn-secondary" onClick={onClose}>
                        Batal
                    </button>
                    <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                        Simpan
                    </button>
                </>
            }
        >
            <div className="grid gap-4">
                <Field label="Nama">{(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
                {voter.type === 'student' ? (
                    <Field label="Kelas">{(id) => <input id={id} className="input" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} />}</Field>
                ) : (
                    <Field label="Kode guru (pembeda bila nama + tgl lahir sama)">
                        {(id) => <input id={id} className="input" value={form.distinguisher} onChange={(e) => setForm({ ...form, distinguisher: e.target.value })} />}
                    </Field>
                )}
                <Field label="Tanggal lahir">{(id) => <input id={id} type="date" className="input" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />}</Field>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="size-5 rounded accent-brand-700" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    Pemilih aktif (berhak memilih)
                </label>
                {error && <Alert type="danger">{error}</Alert>}
            </div>
        </Modal>
    );
}

const EMPTY_VOTER = { type: 'student', identifier: '', name: '', class_name: '', birth_date: '', distinguisher: '' };

/** Input pemilih satu per satu. "Simpan & tambah lagi" mempertahankan jenis & kelas agar input per kelas cepat. */
function AddVoter({ classes, onClose, onSaved }) {
    const [form, setForm] = useState(EMPTY_VOTER);
    const [errors, setErrors] = useState({});
    const [error, setError] = useState(null);
    const [count, setCount] = useState(0);
    const identRef = useRef(null);
    const student = form.type === 'student';

    const set = (k) => (e) => {
        setForm({ ...form, [k]: e.target.value });
        setErrors((x) => ({ ...x, [k]: null }));
    };

    function validate() {
        const e = {};
        const id = form.identifier.replace(/[\s.-]/g, '');
        if (student && !/^\d{10}$/.test(id)) e.identifier = id ? `NISN harus 10 digit angka (sekarang ${id.length}).` : 'NISN wajib diisi.';
        if (!student && id && !/^\d{18}$/.test(id)) e.identifier = `NIP harus 18 digit angka (sekarang ${id.length}), atau kosongkan.`;
        if (!form.name.trim()) e.name = 'Nama wajib diisi.';
        if (student && !form.class_name.trim()) e.class_name = 'Kelas wajib diisi.';
        if (!form.birth_date) e.birth_date = 'Tanggal lahir wajib diisi.';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    const save = useMutation({
        mutationFn: () => api.post('/panitia/voters', { ...form, class_name: student ? form.class_name : null, distinguisher: student ? null : form.distinguisher || null }),
        onError: (e) => {
            const errs = e.response?.data?.errors;
            if (errs) setErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, v[0]])));
            setError(errorMessage(e));
        },
    });

    async function submit(again) {
        setError(null);
        if (!validate()) return;
        try {
            const { data } = await save.mutateAsync();
            toast.success(data.message || 'Pemilih ditambahkan.');
            onSaved();
            if (again) {
                setCount((c) => c + 1);
                setForm({ ...EMPTY_VOTER, type: form.type, class_name: form.class_name });
                setErrors({});
                identRef.current?.focus();
            } else {
                onClose();
            }
        } catch {
            /* ditangani onError */
        }
    }

    return (
        <Modal
            open
            onClose={onClose}
            title="Tambah pemilih"
            footer={
                <>
                    <button className="btn-secondary" onClick={onClose}>
                        Tutup
                    </button>
                    <button className="btn-secondary" onClick={() => submit(true)} disabled={save.isPending}>
                        Simpan &amp; tambah lagi
                    </button>
                    <button className="btn-primary" onClick={() => submit(false)} disabled={save.isPending}>
                        {save.isPending ? 'Menyimpan…' : 'Simpan'}
                    </button>
                </>
            }
        >
            <form
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit(true);
                }}
            >
                <div role="radiogroup" aria-label="Jenis pemilih" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                    {[
                        ['student', 'Siswa'],
                        ['teacher', 'Guru / staf'],
                    ].map(([v, l]) => (
                        <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={form.type === v}
                            onClick={() => {
                                setForm({ ...form, type: v });
                                setErrors({});
                            }}
                            className={`min-h-11 rounded-xl px-3 text-sm font-bold transition ${
                                form.type === v ? 'bg-brand-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                <Field label={student ? 'NISN (10 digit)' : 'NIP (18 digit, kosongkan bila tidak punya)'} error={errors.identifier}>
                    {(id) => (
                        <input
                            id={id}
                            ref={identRef}
                            className="input font-mono"
                            inputMode="numeric"
                            autoComplete="off"
                            value={form.identifier}
                            onChange={set('identifier')}
                            placeholder={student ? '0071234567' : '198001012005011001'}
                        />
                    )}
                </Field>
                <Field label="Nama lengkap" error={errors.name}>
                    {(id) => <input id={id} className="input" autoComplete="off" value={form.name} onChange={set('name')} />}
                </Field>
                {student ? (
                    <Field label="Kelas" error={errors.class_name} hint="Ketik atau pilih kelas yang sudah ada.">
                        {(id) => (
                            <>
                                <input id={id} className="input" list="add-voter-classes" autoComplete="off" value={form.class_name} onChange={set('class_name')} placeholder="XI IPA 1" />
                                <datalist id="add-voter-classes">
                                    {classes?.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </>
                        )}
                    </Field>
                ) : (
                    <Field label="Kode guru (opsional)" error={errors.distinguisher} hint="Wajib bila ada guru tanpa NIP dengan nama & tanggal lahir yang sama.">
                        {(id) => <input id={id} className="input" value={form.distinguisher} onChange={set('distinguisher')} placeholder="G-21" />}
                    </Field>
                )}
                <Field label="Tanggal lahir" error={errors.birth_date} hint="Dipakai untuk jalur cadangan (NISN/NIP + tanggal lahir).">
                    {(id) => <input id={id} type="date" className="input" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={set('birth_date')} />}
                </Field>
                <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
                {error && <Alert type="danger">{error}</Alert>}
                {count > 0 && <p className="text-sm font-medium text-emerald-700">{count} pemilih sudah ditambahkan di sesi ini.</p>}
            </form>
        </Modal>
    );
}

export default function Pemilih() {
    const qc = useQueryClient();
    const [filters, setFilters] = useState({ q: '', type: '', class_name: '', face: '', status: '', page: 1 });
    const [showImport, setShowImport] = useState(false);
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);

    const classes = useQuery({ queryKey: ['voter-classes'], queryFn: () => api.get('/panitia/voters/classes').then((r) => r.data.data) });
    const list = useQuery({
        queryKey: ['voters', filters],
        queryFn: () => api.get('/panitia/voters', { params: { ...filters, per_page: 50 } }).then((r) => r.data),
        placeholderData: keepPreviousData,
    });

    const unlock = useMutation({
        mutationFn: (id) => api.post(`/panitia/voters/${id}/unlock`),
        onSuccess: () => {
            toast.success('Pemilih dibuka kuncinya.');
            qc.invalidateQueries({ queryKey: ['voters'] });
        },
        onError: (e) => toast.error(errorMessage(e)),
    });

    const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value, page: 1 });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Daftar Pemilih</h1>
                    <p className="mt-0.5 text-sm text-slate-500">Kelola data siswa &amp; guru, status pendaftaran wajah, serta pembukaan kunci akun.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={() => setAdding(true)}>
                        <IconUsers className="size-4" />
                        + Tambah pemilih
                    </button>
                    <button className="btn-secondary" onClick={() => setShowImport(!showImport)}>
                        <IconUpload className="size-4" />
                        {showImport ? 'Tutup impor' : 'Impor CSV (massal)'}
                    </button>
                </div>
            </div>

            {adding && (
                <AddVoter
                    classes={classes.data}
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        qc.invalidateQueries({ queryKey: ['voters'] });
                        qc.invalidateQueries({ queryKey: ['voter-classes'] });
                    }}
                />
            )}

            {showImport && (
                <section className="card">
                    <ImportPanel
                        onDone={() => {
                            qc.invalidateQueries({ queryKey: ['voters'] });
                            qc.invalidateQueries({ queryKey: ['voter-classes'] });
                        }}
                    />
                </section>
            )}

            <section className="card">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <input className="input lg:col-span-2" placeholder="Cari nama / NISN / NIP / kelas" value={filters.q} onChange={set('q')} aria-label="Cari" />
                    <select className="input" value={filters.type} onChange={set('type')} aria-label="Jenis">
                        <option value="">Semua jenis</option>
                        <option value="student">Siswa</option>
                        <option value="teacher">Guru</option>
                    </select>
                    <select className="input" value={filters.class_name} onChange={set('class_name')} aria-label="Kelas">
                        <option value="">Semua kelas</option>
                        {classes.data?.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                    <select
                        className="input"
                        value={filters.face || filters.status}
                        onChange={(e) => {
                            const v = e.target.value;
                            const isFace = ['yes', 'no', 'duplicate'].includes(v);
                            setFilters({ ...filters, face: isFace ? v : '', status: isFace ? '' : v, page: 1 });
                        }}
                        aria-label="Status"
                    >
                        <option value="">Semua status</option>
                        <option value="no">Belum terdaftar wajah</option>
                        <option value="yes">Sudah terdaftar wajah</option>
                        <option value="duplicate">Wajah ganda ditandai</option>
                        <option value="voted">Sudah memilih</option>
                        <option value="not_voted">Belum memilih</option>
                        <option value="locked">Terkunci</option>
                        <option value="inactive">Nonaktif</option>
                    </select>
                </div>

                <div className="mt-4">
                    {list.isLoading ? (
                        <Spinner label="Memuat data pemilih…" />
                    ) : list.data?.data.length === 0 ? (
                        <EmptyState>Tidak ada pemilih yang cocok.</EmptyState>
                    ) : (
                        <div className="table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Nomor induk</th>
                                        <th>Kelas</th>
                                        <th>Tgl lahir</th>
                                        <th>Wajah</th>
                                        <th>Status</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {list.data?.data.map((v) => (
                                        <tr key={v.id} className={v.is_active ? '' : 'opacity-50'}>
                                            <td className="font-semibold text-slate-900">{v.name}</td>
                                            <td className="font-mono text-xs">{v.identifier || (v.distinguisher ? `kode ${v.distinguisher}` : '— (tanpa NIP)')}</td>
                                            <td>{v.type === 'teacher' ? 'Guru' : v.class_name}</td>
                                            <td className="font-mono text-xs">{v.birth_date}</td>
                                            <td>
                                                {v.face?.registered ? (
                                                    v.face.duplicate_of_voter_id ? (
                                                        <Badge color="red">Ganda? ({v.face.duplicate_score})</Badge>
                                                    ) : (
                                                        <Badge color="green" dot>
                                                            Terdaftar
                                                        </Badge>
                                                    )
                                                ) : (
                                                    <Badge>Belum</Badge>
                                                )}
                                            </td>
                                            <td className="space-x-1">
                                                {v.has_voted && <Badge color="blue">Sudah memilih</Badge>}
                                                {v.is_locked && <Badge color="red">Terkunci</Badge>}
                                                {!v.is_locked && v.failed_attempts > 0 && <Badge color="yellow">{v.failed_attempts}× salah</Badge>}
                                            </td>
                                            <td className="text-right whitespace-nowrap">
                                                {v.is_locked && (
                                                    <button className="btn-secondary btn-sm mr-1" onClick={() => unlock.mutate(v.id)}>
                                                        Buka kunci
                                                    </button>
                                                )}
                                                <button className="btn-ghost btn-sm" onClick={() => setEditing(v)}>
                                                    Ubah
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pagination meta={list.data?.meta} onPage={(page) => setFilters({ ...filters, page })} />
                    {list.data?.meta && <p className="mt-2 text-xs text-slate-500">Total {number(list.data.meta.total)} pemilih sesuai filter.</p>}
                </div>
            </section>

            {editing && <EditVoter voter={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
