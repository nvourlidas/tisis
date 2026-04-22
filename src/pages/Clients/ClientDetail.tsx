import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, FileText, Pencil, Check, X } from 'lucide-react';
import { fetchClient, updateClient } from './clientUtils';
import { supabase } from '../../lib/supabase';
import type { Client } from './types';

type CaseSummary = { id: string; code: string; title: string; status: string };

const STATUS_LABELS: Record<string, string> = {
  active: 'Ενεργή',
  pending: 'Εκκρεμής',
  closed: 'Κλειστή',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  closed: 'bg-border/20 text-text-secondary',
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchClient(id),
      supabase.from('cases').select('id, code, title, status').eq('client_id', id).order('created_at', { ascending: false }),
    ]).then(([c, { data: caseData }]) => {
      setClient(c);
      setForm(c ?? {});
      setCases(caseData ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => { setForm(client ?? {}); setEditing(true); setError(null); };
  const cancelEdit = () => { setEditing(false); setError(null); };

  const saveEdit = async () => {
    if (!id || !form.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateClient(id, {
        name: form.name, phone: form.phone ?? '', phone2: form.phone2 ?? '',
        email: form.email ?? '', vat: form.vat ?? '', address: form.address ?? '',
        professional_status: form.professional_status ?? '', notes: form.notes ?? '',
      });
      setClient((prev) => prev ? { ...prev, ...form } : prev);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!client) return <div className="p-6 text-sm text-text-secondary">Ο πελάτης δεν βρέθηκε.</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <button onClick={() => navigate('/clients')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
        <ArrowLeft className="h-4 w-4" />
        Πελάτες
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          {editing ? (
            <input className="input text-xl font-bold w-full max-w-sm" value={form.name ?? ''} onChange={set('name')} required />
          ) : (
            <h1 className="text-xl font-bold text-text-primary">{client.name}</h1>
          )}
          {client.professional_status && !editing && (
            <p className="text-sm text-text-secondary mt-0.5">{client.professional_status}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <button onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><X className="h-3.5 w-3.5" />Ακύρωση</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer"><Check className="h-3.5 w-3.5" />{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
            </>
          ) : (
            <button onClick={startEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><Pencil className="h-3.5 w-3.5" />Επεξεργασία</button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="rounded-xl border border-border/10 bg-secondary-background divide-y divide-border/10">
        {editing ? (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['phone', 'Τηλέφωνο'],
              ['phone2', 'Τηλέφωνο 2'],
              ['email', 'Email'],
              ['vat', 'ΑΦΜ'],
              ['professional_status', 'Επαγγελματική Ιδιότητα'],
              ['address', 'Διεύθυνση'],
            ] as [keyof Client, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs text-text-secondary mb-1">{label}</label>
                <input className="input w-full" value={(form[k] as string) ?? ''} onChange={set(k)} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
              <textarea className="input w-full resize-none" rows={3} value={(form.notes as string) ?? ''} onChange={set('notes')} />
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {client.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο" value={client.phone} />}
            {client.phone2 && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο 2" value={client.phone2} />}
            {client.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />}
            {client.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Διεύθυνση" value={client.address} />}
            {client.vat && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΦΜ" value={client.vat} />}
            {client.notes && (
              <div className="sm:col-span-2 text-sm text-text-secondary bg-white/3 rounded-lg p-3">{client.notes}</div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Υποθέσεις ({cases.length})</h2>
          <Link to={`/cases?client=${id}`} className="text-xs text-primary hover:underline">Προβολή όλων</Link>
        </div>
        {cases.length === 0 ? (
          <p className="text-sm text-text-secondary">Δεν υπάρχουν υποθέσεις ακόμα.</p>
        ) : (
          <div className="rounded-xl border border-border/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Κωδικός</th>
                  <th className="text-left px-4 py-2.5 font-medium">Τίτλος</th>
                  <th className="text-left px-4 py-2.5 font-medium">Κατάσταση</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {cases.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)} className="hover:bg-white/3 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{c.code}</td>
                    <td className="px-4 py-2.5 text-text-primary">{c.title}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-border/20 text-text-secondary'}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-text-secondary mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-text-secondary">{label}</div>
        <div className="text-sm text-text-primary">{value}</div>
      </div>
    </div>
  );
}
