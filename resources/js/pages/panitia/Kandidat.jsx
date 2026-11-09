import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { Alert, EmptyState, Field, Modal, Spinner, toast } from '../../components/ui';
import { useElection } from './PanitiaLayout';

function CandidateForm({ candidate, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        number: candidate?.number ?? '',
        name: candidate?.name ?? '',
        class_name: candidate?.class_name ?? '',
        vision: candidate?.vision ?? '',
        mission: candidate?.mission ?? '',
        is_active: candidate?.is_active ?? true,
    });
    const [photo, setPhoto] = useState(null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const [error, setError] = useState(null);

    const save = useMutation({
        mutationFn: () => {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, typeof v === 'boolean' ? (v ? '1' : '0') : v ?? ''));
            if (photo) fd.append('photo', photo);
            if (removePhoto) fd.append('remove_photo', '1');
            return candidate ? api.post(`/panitia/candidates/${candidate.id}`, fd) : api.post('/panitia/candidates', fd);
        },
        onSuccess: () => {
            toast.success('Kandidat disimpan.');
            qc.invalidateQueries({ queryKey: ['candidates'] });
            onClose();
        },
        onError: (e) => setError(errorMessage(e)),
    });

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

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
                    <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
                        {save.isPending ? 'Menyimpan…' : 'Simpan'}
                    </button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <Field label="No. urut">{(id) => <input id={id} type="number" min="1" max="99" className="input" value={form.number} onChange={set('number')} />}</Field>
                <Field label="Nama (pasangan)">{(id) => <input id={id} className="input" value={form.name} onChange={set('name')} placeholder="Raka Pratama & Nadia Putri" />}</Field>
            </div>
            <div className="mt-4 grid gap-4">
                <Field label="Kelas">{(id) => <input id={id} className="input" value={form.class_name} onChange={set('class_name')} />}</Field>
                <Field label="Foto kandidat (JPG/PNG/WebP, maks. 2 MB)">
                    {(id) => <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="input py-2.5" onChange={(e) => setPhoto(e.target.files[0] || null)} />}
                </Field>
                {candidate?.photo_url && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} /> Hapus foto saat ini
                    </label>
                )}
                <Field label="Visi">{(id) => <textarea id={id} rows={3} className="input" value={form.vision} onChange={set('vision')} />}</Field>
                <Field label="Misi (satu per baris)">{(id) => <textarea id={id} rows={5} className="input" value={form.mission} onChange={set('mission')} />}</Field>
                <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-5" checked={form.is_active} onChange={set('is_active')} /> Aktif (tampil di kiosk)
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Kandidat</h1>
                {editable && (
                    <button className="btn-primary" onClick={() => setEditing('new')}>
                        Tambah kandidat
                    </button>
                )}
            </div>
            {!election && <Alert>Buat pemilihan terlebih dahulu di menu Jadwal &amp; Status.</Alert>}
            {election && !editable && <Alert type="warning">Data kandidat terkunci karena pemilihan sudah tidak berstatus draf.</Alert>}

            {list.isLoading && <Spinner />}
            {list.data?.length === 0 && <EmptyState>Belum ada kandidat.</EmptyState>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.data?.map((c) => (
                    <article key={c.id} className={`card flex flex-col ${c.is_active ? '' : 'opacity-60'}`}>
                        <div className="relative -mx-4 -mt-4 mb-4 aspect-[4/3] overflow-hidden rounded-t-2xl bg-slate-100 sm:-mx-6 sm:-mt-6">
                            {c.photo_url ? <img src={c.photo_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl font-black text-slate-300">{c.number}</div>}
                            <span className="absolute top-3 left-3 rounded-xl bg-brand-800 px-3 py-1 text-xl font-black text-white">{c.number}</span>
                        </div>
                        <h2 className="text-lg font-bold">{c.name}</h2>
                        <p className="text-sm text-slate-500">{c.class_name}</p>
                        {c.vision && <p className="mt-2 text-sm text-slate-700">{c.vision}</p>}
                        {c.mission && (
                            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                                {c.mission.split('\n').filter(Boolean).map((m, i) => (
                                    <li key={i}>{m}</li>
                                ))}
                            </ul>
                        )}
                        {editable && (
                            <div className="mt-auto flex gap-2 pt-4">
                                <button className="btn-secondary btn-sm" onClick={() => setEditing(c)}>
                                    Ubah
                                </button>
                                <button className="btn-ghost btn-sm text-red-700" onClick={() => confirm(`Hapus kandidat ${c.name}?`) && remove.mutate(c.id)}>
                                    Hapus
                                </button>
                            </div>
                        )}
                    </article>
                ))}
            </div>

            {editing && <CandidateForm candidate={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
