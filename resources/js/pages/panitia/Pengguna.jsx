import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { IconShieldCheck } from '../../components/Icons';
import { Alert, Badge, Field, Modal, Spinner, toast } from '../../components/ui';
import { useSessions } from '../../components/SessionSwitcher';

function UserForm({ user, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({ name: user?.name || '', username: user?.username || '', email: user?.email || '', password: '', role: user?.role || 'panitia', election_id: user?.election_id ?? '', is_active: user?.is_active ?? true });
    const sessions = useSessions();
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: () => {
            const payload = { ...form, election_id: form.role === 'admin' || form.election_id === '' ? null : Number(form.election_id) };
            return user ? api.patch(`/panitia/users/${user.id}`, payload) : api.post('/panitia/users', payload);
        },
        onSuccess: () => {
            toast.success('Akun disimpan.');
            qc.invalidateQueries({ queryKey: ['users'] });
            onClose();
        },
        onError: (e) => setError(errorMessage(e)),
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    return (
        <Modal
            open
            onClose={onClose}
            title={user ? 'Ubah akun' : 'Tambah akun'}
            footer={
                <>
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
                <Field label="Nama">{(id) => <input id={id} className="input" value={form.name} onChange={set('name')} />}</Field>
                <Field label="Username (untuk masuk)">{(id) => <input id={id} className="input" value={form.username} onChange={set('username')} autoCapitalize="none" />}</Field>
                <Field label="Email">{(id) => <input id={id} type="email" className="input" value={form.email} onChange={set('email')} />}</Field>
                <Field label={user ? 'Kata sandi baru (kosongkan bila tidak diubah)' : 'Kata sandi (min. 8 karakter)'}>
                    {(id) => <input id={id} type="password" className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />}
                </Field>
                <Field label="Peran">
                    {(id) => (
                        <select id={id} className="input" value={form.role} onChange={set('role')}>
                            <option value="panitia">Panitia</option>
                            <option value="admin">Admin</option>
                        </select>
                    )}
                </Field>
                {form.role === 'panitia' && (
                    <Field label="Akses sesi sekolah" hint="Panitia yang dibatasi hanya dapat melihat & mengelola data sekolahnya sendiri.">
                        {(id) => (
                            <select id={id} className="input" value={form.election_id} onChange={set('election_id')}>
                                <option value="">Semua sesi sekolah</option>
                                {sessions.data?.data.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.label}
                                        {s.is_simulation ? ' (simulasi)' : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </Field>
                )}
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" className="size-5 rounded accent-brand-700" checked={form.is_active} onChange={set('is_active')} /> Aktif
                </label>
                {error && <Alert type="danger">{error}</Alert>}
            </div>
        </Modal>
    );
}

export default function Pengguna() {
    const [editing, setEditing] = useState(null);
    const list = useQuery({ queryKey: ['users'], queryFn: () => api.get('/panitia/users').then((r) => r.data.data) });
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Pengguna Panel</h1>
                    <p className="mt-0.5 text-sm text-slate-500">Kelola akun admin dan panitia yang berwenang mengakses panel kontrol.</p>
                </div>
                <button className="btn-primary" onClick={() => setEditing('new')}>
                    <IconShieldCheck className="size-4" />
                    Tambah akun
                </button>
            </div>
            <section className="card">
                {list.isLoading ? (
                    <Spinner label="Memuat pengguna…" />
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Peran</th>
                                    <th>Akses sesi</th>
                                    <th>Status</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {list.data?.map((u) => (
                                    <tr key={u.id}>
                                        <td className="font-semibold text-slate-900">{u.name}</td>
                                        <td className="font-mono text-xs">{u.username || '—'}</td>
                                        <td>{u.email}</td>
                                        <td>
                                            <Badge color={u.role === 'admin' ? 'blue' : 'gray'}>{u.role}</Badge>
                                        </td>
                                        <td className="text-sm">{u.role === 'admin' || !u.election_label ? <span className="text-slate-500">Semua sekolah</span> : u.election_label}</td>
                                        <td>{u.is_active ? <Badge color="green" dot>Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
                                        <td className="text-right">
                                            <button className="btn-ghost btn-sm" onClick={() => setEditing(u)}>
                                                Ubah
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
            {editing && <UserForm user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
