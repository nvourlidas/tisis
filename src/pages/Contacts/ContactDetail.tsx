import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Tag, Pencil, Check, X } from 'lucide-react';
import { fetchContact, fetchContactCases, updateContact } from './contactUtils';
import type { Contact, ContactCase } from './types';

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

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [cases, setCases] = useState<ContactCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchContact(id), fetchContactCases(id)])
      .then(([c, cc]) => {
        setContact(c);
        setForm(c ?? {});
        setCases(cc);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => { setForm(contact ?? {}); setEditing(true); setError(null); };
  const cancelEdit = () => { setEditing(false); setError(null); };

  const saveEdit = async () => {
    if (!id || !form.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateContact(id, {
        name: form.name,
        phone: form.phone ?? '',
        email: form.email ?? '',
        role: form.role ?? '',
        notes: form.notes ?? '',
      });
      setContact((prev) => prev ? { ...prev, ...form } : prev);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!contact) return <div className="p-6 text-sm text-text-secondary">Η επαφή δεν βρέθηκε.</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <button onClick={() => navigate('/contacts')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
        <ArrowLeft className="h-4 w-4" />
        Επαφές
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          {editing ? (
            <input className="input text-xl font-bold w-full max-w-sm" value={form.name ?? ''} onChange={set('name')} required />
          ) : (
            <h1 className="text-xl font-bold text-text-primary">{contact.name}</h1>
          )}
          {contact.role && !editing && (
            <p className="text-sm text-text-secondary mt-0.5">{contact.role}</p>
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

      <div className="rounded-xl border border-border/10 bg-secondary-background">
        {editing ? (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['phone', 'Τηλέφωνο'],
              ['email', 'Email'],
              ['role', 'Ρόλος'],
            ] as [keyof Contact, string][]).map(([k, label]) => (
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
            {contact.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο" value={contact.phone} />}
            {contact.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={contact.email} />}
            {contact.role && <InfoRow icon={<Tag className="h-4 w-4" />} label="Ρόλος" value={contact.role} />}
            {contact.notes && (
              <div className="sm:col-span-2 text-sm text-text-secondary bg-white/3 rounded-lg p-3">{contact.notes}</div>
            )}
            {!contact.phone && !contact.email && !contact.role && !contact.notes && (
              <p className="text-sm text-text-secondary">Δεν υπάρχουν στοιχεία.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Συνδεδεμένες Υποθέσεις ({cases.length})</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-text-secondary">Η επαφή δεν είναι συνδεδεμένη σε καμία υπόθεση.</p>
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
                  <tr key={c.case_id} onClick={() => navigate(`/cases/${c.case_id}`)} className="hover:bg-white/3 cursor-pointer transition-colors">
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
