import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { IconCopy, IconDeviceTablet, IconFaceScan, IconVoteBox } from '../../components/Icons';
import { Alert, Badge, EmptyState, Field, Modal, Spinner, toast } from '../../components/ui';

export default function Perangkat() {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [role, setRole] = useState('checkin');
    const [created, setCreated] = useState(null);
    const list = useQuery({ queryKey: ['devices'], queryFn: () => api.get('/panitia/devices').then((r) => r.data.data), refetchInterval: 15_000 });

    const register = useMutation({
        mutationFn: () => api.post('/panitia/devices', { name, role }),
        onSuccess: ({ data }) => {
            setCreated(data);
            setName('');
            qc.invalidateQueries({ queryKey: ['devices'] });
        },
        onError: (e) => toast.error(errorMessage(e)),
    });
    const revoke = useMutation({
        mutationFn: (id) => api.post(`/panitia/devices/${id}/revoke`),
        onSuccess: () => {
            toast.success('Token perangkat dicabut. Tablet langsung ditolak.');
            qc.invalidateQueries({ queryKey: ['devices'] });
        },
        onError: (e) => toast.error(errorMessage(e)),
    });

    const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Disalin.'), () => toast.error('Gagal menyalin; salin manual.'));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Perangkat Kiosk &amp; Bilik</h1>
                <p className="mt-0.5 text-sm text-slate-500">Daftarkan tablet meja check-in dan perangkat bilik suara dengan token terisolasi.</p>
            </div>

            <section className="card space-y-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-white">
                            <IconFaceScan className="size-5" />
                        </span>
                        <div>
                            <p className="font-bold text-slate-900">1. Meja check-in</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                                Tablet berkamera di pintu masuk. Mengenali wajah / NISN, menampilkan nama, lalu mempersilakan pemilih ke bilik. Tidak bisa memungut suara.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/50 p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                            <IconVoteBox className="size-5" />
                        </span>
                        <div>
                            <p className="font-bold text-slate-900">2. Bilik suara</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                                Laptop/tablet di dalam bilik. Hanya menampilkan surat suara — tidak pernah tahu siapa yang memilih. Tidak perlu kamera.
                            </p>
                        </div>
                    </div>
                </div>

                <form
                    className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        register.mutate();
                    }}
                >
                    <div className="min-w-56 flex-1">
                        <Field label="Nama perangkat">
                            {(id) => (
                                <input
                                    id={id}
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={role === 'booth' ? 'Bilik 1' : 'Check-in 1 – Pintu aula'}
                                    required
                                />
                            )}
                        </Field>
                    </div>
                    <div className="min-w-48">
                        <Field label="Peran">
                            {(id) => (
                                <select id={id} className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                                    <option value="checkin">Meja check-in</option>
                                    <option value="booth">Bilik suara</option>
                                </select>
                            )}
                        </Field>
                    </div>
                    <button className="btn-primary" disabled={register.isPending || !name}>
                        <IconDeviceTablet className="size-4" />
                        Daftarkan perangkat
                    </button>
                </form>

                <p className="text-xs leading-relaxed text-slate-500">
                    Setelah didaftarkan, buka tautan pemasangan di Chrome perangkat tersebut (sekali saja); perangkat otomatis membuka halaman sesuai perannya. Token hanya ditampilkan sekali. Bila perangkat hilang/dipinjam, segera cabut.
                </p>
            </section>

            <section className="card">
                {list.isLoading ? (
                    <Spinner label="Memuat daftar perangkat…" />
                ) : list.data?.length === 0 ? (
                    <EmptyState>Belum ada tablet atau perangkat bilik yang terdaftar.</EmptyState>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Peran</th>
                                    <th>Status</th>
                                    <th>Terakhir terlihat</th>
                                    <th>IP</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {list.data.map((d) => (
                                    <tr key={d.id}>
                                        <td className="font-semibold text-slate-900">{d.name}</td>
                                        <td>{d.role === 'booth' ? <Badge color="blue">Bilik suara</Badge> : <Badge color="gray">Meja check-in</Badge>}</td>
                                        <td>
                                            {!d.is_active ? (
                                                <Badge>Dicabut</Badge>
                                            ) : d.online ? (
                                                <Badge color="green" dot>
                                                    Aktif
                                                </Badge>
                                            ) : (
                                                <Badge color="yellow">Tidak terlihat</Badge>
                                            )}
                                        </td>
                                        <td>{formatDateTime(d.last_seen_at)}</td>
                                        <td className="font-mono text-xs">{d.last_ip || '—'}</td>
                                        <td className="text-right">
                                            {d.is_active && (
                                                <button
                                                    className="btn-ghost btn-sm text-crimson-700 hover:bg-crimson-50"
                                                    onClick={() => confirm(`Cabut token "${d.name}"? Tablet langsung tidak bisa dipakai.`) && revoke.mutate(d.id)}
                                                >
                                                    Cabut
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {created && (
                <Modal
                    open
                    onClose={() => setCreated(null)}
                    title={`Perangkat “${created.device.name}” terdaftar`}
                    footer={
                        <button className="btn-primary" onClick={() => setCreated(null)}>
                            Sudah saya simpan
                        </button>
                    }
                >
                    <Alert type="warning">{created.message}</Alert>
                    <div className="mt-4 space-y-3">
                        <Field label="Tautan pemasangan (buka di tablet)">
                            {(id) => (
                                <div className="flex gap-2">
                                    <input id={id} className="input font-mono text-xs" readOnly value={created.setup_url} onFocus={(e) => e.target.select()} />
                                    <button type="button" className="btn-secondary shrink-0" onClick={() => copy(created.setup_url)}>
                                        <IconCopy className="size-4" />
                                        Salin
                                    </button>
                                </div>
                            )}
                        </Field>
                        <Field label="Token">
                            {(id) => <input id={id} className="input font-mono text-xs" readOnly value={created.token} onFocus={(e) => e.target.select()} />}
                        </Field>
                    </div>
                </Modal>
            )}
        </div>
    );
}
