import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { IconAward } from '../../components/Icons';
import { Alert, Badge, EmptyState, Field, Modal, Spinner, toast } from '../../components/ui';
import { useElection } from './PanitiaLayout';

const MAX_PHOTO = 2 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function CandidateForm({ candidate, nextNumber, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        number: String(candidate?.number ?? nextNumber ?? ''),
        name: candidate?.name ?? '',
        class_name: candidate?.class_name ?? '',
        vision: candidate?.vision ?? '',
        mission: candidate?.mission ?? '',
        is_active: candidate?.is_active ?? true,
    });
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => () => photoPreview && URL.revokeObjectURL(photoPreview), [photoPreview]);

    function pickPhoto(file) {
        setFieldErrors((f) => ({ ...f, photo: null }));
        setPhoto(null);
        setPhotoPreview(null);
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) {
            setFieldErrors((f) => ({ ...f, photo: 'Format foto harus JPG, PNG, atau WebP.' }));
            return;
        }
        if (file.size > MAX_PHOTO) {
            setFieldErrors((f) => ({ ...f, photo: `Ukuran foto ${(file.size / 1024 / 1024).toFixed(1)} MB — maksimal 2 MB. Kecilkan dulu fotonya.` }));
            return;
        }
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        setRemovePhoto(false);
    }

    function validate() {
        const errs = {};
        const n = form.number.trim();
        if (!n) errs.number = 'Nomor urut wajib diisi.';
        else if (!/^\d+$/.test(n) || Number(n) < 1 || Number(n) > 99) errs.number = 'Nomor urut harus angka 1–99.';
        if (!form.name.trim()) errs.name = 'Nama kandidat wajib diisi.';
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    }

    const save = useMutation({
        mutationFn: () => {
            const fd = new FormData();
            const payload = { ...form, number: String(Number(form.number.trim())) };
            Object.entries(payload).forEach(([k, v]) => fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : (v ?? '')));
            if (photo) fd.append('photo', photo);
            if (removePhoto) fd.append('remove_photo', '1');
            return candidate ? api.post(`/panitia/candidates/${candidate.id}`, fd) : api.post('/panitia/candidates', fd);
        },
        onSuccess: () => {
            toast.success('Kandidat disimpan.');
            qc.invalidateQueries({ queryKey: ['candidates'] });
            onClose();
        },
        onError: (e) => {
            const errs = e.response?.data?.errors;
            if (errs) setFieldErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, v[0]])));
            setError(e.response?.status === 413 ? 'Ukuran unggahan terlalu besar untuk server. Gunakan foto maks. 2 MB.' : errorMessage(e));
        },
    });

    function submit() {
        setError(null);
        if (validate()) save.mutate();
    }

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const shownPhoto = photoPreview || (!removePhoto && candidate?.photo_url) || null;

    return (
        <Modal
            open
            onClose={onClose}
            size="lg"
            title={candidate ? `Ubah kandidat No. ${candidate.number}` : 'Tambah kandidat'}
            footer={
                <>
                    <button className="btn-secondary" onClick={onClose}>
                        Batal
                    </button>
                    <button className="btn-primary" onClick={submit} disabled={save.isPending}>
                        {save.isPending ? 'Menyimpan…' : 'Simpan'}
                    </button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Field label="No. urut" error={fieldErrors.number}>
                    {(id) => (
                        <input
                            id={id}
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            className="input text-center font-mono text-lg font-bold"
                            value={form.number}
                            onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, '') })}
                        />
                    )}
                </Field>
                <Field label="Nama (pasangan)" error={fieldErrors.name}>
                    {(id) => <input id={id} className="input" value={form.name} onChange={set('name')} placeholder="Raka Pratama & Nadia Putri" />}
                </Field>
            </div>
            <div className="mt-4 grid gap-4">
                <Field label="Kelas" error={fieldErrors.class_name}>
                    {(id) => <input id={id} className="input" value={form.class_name} onChange={set('class_name')} placeholder="XI IPA 1" />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-start">
                    <div className="mx-auto flex aspect-[3/4] w-32 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:w-full">
                        {shownPhoto ? (
                            <img src={shownPhoto} alt="Pratinjau foto kandidat" className="h-full w-full object-cover" />
                        ) : (
                            <span className="px-2 text-center text-xs text-slate-400">Belum ada foto</span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Field label="Foto kandidat (JPG/PNG/WebP, maks. 2 MB)" error={fieldErrors.photo} hint="Opsional. Disarankan potret 3:4.">
                            {(id) => <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="input py-2" onChange={(e) => pickPhoto(e.target.files[0] || null)} />}
                        </Field>
                        {candidate?.photo_url && !photo && (
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="size-4 rounded accent-brand-700" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} /> Hapus foto saat ini
                            </label>
                        )}
                    </div>
                </div>
                <Field label="Visi" error={fieldErrors.vision}>
                    {(id) => <textarea id={id} rows={3} className="input" value={form.vision} onChange={set('vision')} />}
                </Field>
                <Field label="Misi (satu per baris)" error={fieldErrors.mission}>
                    {(id) => <textarea id={id} rows={5} className="input" value={form.mission} onChange={set('mission')} />}
                </Field>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="size-5 rounded accent-brand-700" checked={form.is_active} onChange={set('is_active')} /> Aktif (tampil di kiosk)
                </label>
                {error && <Alert type="danger">{error}</Alert>}
            </div>
        </Modal>
    );
}

export default function Kandidat() {
    const qc = useQueryClient();
    const { data: election } = useElection();
    const [editing, setEditing] = useState(null);
    const list = useQuery({ queryKey: ['candidates'], queryFn: () => api.get('/panitia/candidates').then((r) => r.data.data) });
    const editable = election?.status === 'draft';

    const remove = useMutation({
        mutationFn: (id) => api.delete(`/panitia/candidates/${id}`),
        onSuccess: () => {
            toast.success('Kandidat dihapus.');
            qc.invalidateQueries({ queryKey: ['candidates'] });
        },
        onError: (e) => toast.error(errorMessage(e)),
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Kandidat</h1>
                    <p className="mt-0.5 text-sm text-slate-500">Daftar pasangan calon Ketua OSIS beserta foto, visi, dan misi.</p>
                </div>
                {editable && (
                    <button className="btn-primary" onClick={() => setEditing('new')}>
                        <IconAward className="size-4" />
                        Tambah kandidat
                    </button>
                )}
            </div>
            {!election && <Alert>Buat pemilihan terlebih dahulu di menu Jadwal &amp; Status.</Alert>}
            {election && !editable && <Alert type="warning">Data kandidat terkunci karena pemilihan sudah tidak berstatus draf.</Alert>}

            {list.isLoading && <Spinner label="Memuat kandidat…" />}
            {list.data?.length === 0 && <EmptyState>Belum ada kandidat.</EmptyState>}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.data?.map((c) => (
                    <article key={c.id} className={`card flex flex-col overflow-hidden p-0 sm:p-0 ${c.is_active ? '' : 'opacity-65'}`}>
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                            {c.photo_url ? (
                                <img src={c.photo_url} alt={c.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-6xl font-black text-slate-300">
                                    {c.number}
                                </div>
                            )}
                            <span className="absolute top-3 left-3 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-900 to-brand-700 font-mono text-xl font-black text-white shadow-md ring-2 ring-white/80">
                                {c.number}
                            </span>
                            {!c.is_active && (
                                <span className="absolute top-3 right-3">
                                    <Badge color="gray">Nonaktif</Badge>
                                </span>
                            )}
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{c.name}</h2>
                            {c.class_name && <p className="text-sm font-semibold text-brand-700">{c.class_name}</p>}
                            {c.vision && <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{c.vision}</p>}
                            {c.mission && (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                                    {c.mission.split('\n').filter(Boolean).map((m, i) => (
                                        <li key={i}>{m}</li>
                                    ))}
                                </ul>
                            )}
                            {editable && (
                                <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
                                    <button className="btn-secondary btn-sm flex-1" onClick={() => setEditing(c)}>
                                        Ubah
                                    </button>
                                    <button
                                        className="btn-ghost btn-sm text-crimson-700 hover:bg-crimson-50"
                                        onClick={() => confirm(`Hapus kandidat ${c.name}?`) && remove.mutate(c.id)}
                                    >
                                        Hapus
                                    </button>
                                </div>
                            )}
                        </div>
                    </article>
                ))}
            </div>

            {editing && (
                <CandidateForm
                    candidate={editing === 'new' ? null : editing}
                    nextNumber={(list.data ?? []).reduce((m, c) => Math.max(m, c.number), 0) + 1}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
}
