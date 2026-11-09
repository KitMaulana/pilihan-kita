import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Alert, Badge, EmptyState, Field, Modal, Spinner, toast } from '../../components/ui';

export default function Perangkat() {
    const qc = useQueryClient();
    const [name, setName] = useState('');
    const [created, setCreated] = useState(null);
    const list = useQuery({ queryKey: ['devices'], queryFn: () => api.get('/panitia/devices').then((r) => r.data.data), refetchInterval: 15_000 });

    const register = useMutation({
        mutationFn: () => api.post('/panitia/devices', { name }),
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
            <h1 className="text-2xl font-bold text-slate-900">Perangkat (Tablet Kiosk)</h1>

            <section className="card">
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        register.mutate();
                    }}
                >
                    <div className="min-w-56 flex-1">
                        <Field label="Nama tablet">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tablet 1 – Aula" required />}</Field>
                    </div>
                    <button className="btn-primary" disabled={register.isPending || !name}>
                        Daftarkan tablet
                    </button>
                </form>
                <p className="mt-3 text-sm text-slate-500">
                    Setelah didaftarkan, buka tautan pemasangan di Chrome tablet tersebut (sekali saja). Token hanya ditampilkan sekali. Bila tablet hilang/dipinjam, segera cabut.
                </p>
            </section>

            <section className="card">
                {list.isLoading ? (
                    <Spinner />
                ) : list.data?.length === 0 ? (
                    <EmptyState>Belum ada tablet.</EmptyState>
                ) : (
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Status</th>
                                    <th>Terakhir terlihat</th>
                                    <th>IP</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {list.data.map((d) => (
                                    <tr key={d.id}>
                                        <td className="font-medium">{d.name}</td>
                                        <td>{!d.is_active ? <Badge>Dicabut</Badge> : d.online ? <Badge color="green">Aktif</Badge> : <Badge color="yellow">Tidak terlihat</Badge>}</td>
                                        <td>{formatDateTime(d.last_seen_at)}</td>
                                        <td className="font-mono text-xs">{d.last_ip || '—'}</td>
                                        <td className="text-right">
                                            {d.is_active && (
                                                <button className="btn-ghost btn-sm text-red-700" onClick={() => confirm(`Cabut token "${d.name}"? Tablet langsung tidak bisa dipakai.`) && revoke.mutate(d.id)}>
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
                    title={`Tablet “${created.device.name}” terdaftar`}
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
                                    <button className="btn-secondary" onClick={() => copy(created.setup_url)}>
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
