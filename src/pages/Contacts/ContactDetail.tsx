import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Tag, FileText, MapPin, Pencil, Check, X, UserCheck, ExternalLink, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchContact, fetchContactCases, updateContact, deleteContact, fetchLinkedClient, promoteContactToClient } from './contactUtils';
import type { Contact, ContactCase } from './types';
import type { Client } from '../Clients/types';
import RoleSelect from '../../components/RoleSelect';

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
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [contact, setContact] = useState<Contact | null>(null);
  const [cases, setCases] = useState<ContactCase[]>([]);
  const [linkedClient, setLinkedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchContact(id), fetchContactCases(id)])
      .then(([c, cc]) => {
        setContact(c);
        setForm(c ?? {});
        setCases(cc);
        if (c?.is_client) fetchLinkedClient(id).then(setLinkedClient);
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
        name: form.name, phone: form.phone ?? '', phone2: form.phone2 ?? '',
        email: form.email ?? '', role: form.role ?? '', notes: form.notes ?? '',
        vat: form.vat ?? '', address: form.address ?? '',
        professional_status: form.professional_status ?? '',
        father_name: form.father_name ?? '', mother_name: form.mother_name ?? '',
        birthdate: form.birthdate ?? '', amka: form.amka ?? '', iban: form.iban ?? '',
        at: form.at ?? '', taxis_username: form.taxis_username ?? '', taxis_password: form.taxis_password ?? '',
      });
      setContact((prev) => prev ? { ...prev, ...form } : prev);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteContact(id);
      navigate('/contacts');
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία διαγραφής.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handlePromote = async () => {
    if (!contact) return;
    setPromoting(true);
    setError(null);
    try {
      const client = await promoteContactToClient(contact);
      setContact((prev) => prev ? { ...prev, is_client: true } : prev);
      setLinkedClient(client);
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία μετατροπής σε εντολέα.');
    } finally {
      setPromoting(false);
    }
  };

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!contact) return <div className="p-6 text-sm text-text-secondary">Η επαφή δεν βρέθηκε.</div>;

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('/contacts')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
        <ArrowLeft className="h-4 w-4" />
        Επαφές
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          {editing ? (
            <input className="input text-xl font-bold w-full max-w-sm" value={form.name ?? ''} onChange={set('name')} required />
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-text-primary">{contact.name}</h1>
              {contact.is_client && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                  Εντολέας
                </span>
              )}
            </div>
          )}
          {contact.role && !editing && (
            <p className="text-sm text-text-secondary mt-0.5">{contact.role}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && !contact.is_client && (
            <button
              onClick={handlePromote}
              disabled={promoting}
              className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {promoting ? 'Μετατροπή…' : 'Μετατροπή σε Εντολέα'}
            </button>
          )}
          {editing ? (
            <>
              <button onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><X className="h-3.5 w-3.5" />Ακύρωση</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer"><Check className="h-3.5 w-3.5" />{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
            </>
          ) : confirmDelete ? (
            <>
              <span className="text-sm text-text-secondary">Σίγουρα;</span>
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><X className="h-3.5 w-3.5" />Ακύρωση</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />{deleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />Διαγραφή
              </button>
              <button onClick={startEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"><Pencil className="h-3.5 w-3.5" />Επεξεργασία</button>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {contact.is_client && linkedClient && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-text-primary">Αυτή η επαφή είναι επίσης εντολέας.</span>
          <button
            onClick={() => navigate(`/clients/${linkedClient.id}`)}
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer"
          >
            Προβολή εντολέα <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border/10 bg-secondary-background">
        {editing ? (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['phone', 'Τηλέφωνο'],
              ['phone2', 'Τηλέφωνο 2'],
              ['email', 'Email'],
              ['vat', 'ΑΦΜ'],
              ['professional_status', 'Επαγγελματική Ιδιότητα'],
              ['address', 'Διεύθυνση'],
              ['father_name', 'Όνομα πατρός'],
              ['mother_name', 'Όνομα μητρός'],
              ['amka', 'ΑΜΚΑ'],
              ['iban', 'IBAN'],
              ['at', 'ΑΤ (Αστυνομική Ταυτότητα)'],
              ['taxis_username', 'Taxisnet Username'],
            ] as [keyof Contact, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs text-text-secondary mb-1">{label}</label>
                <input className="input w-full" value={(form[k] as string) ?? ''} onChange={set(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs text-text-secondary mb-1">Ρόλος</label>
              <RoleSelect tenantId={tenantId} value={form.role ?? ''} onChange={v => setForm(f => ({ ...f, role: v }))} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Taxisnet Password</label>
              <input className="input w-full" type="password" value={(form.taxis_password as string) ?? ''} onChange={set('taxis_password')} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Ημ/νία γέννησης</label>
              <input className="input w-full" type="date" value={(form.birthdate as string) ?? ''} onChange={set('birthdate')} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
              <textarea className="input w-full resize-none" rows={3} value={(form.notes as string) ?? ''} onChange={set('notes')} />
            </div>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contact.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο" value={contact.phone} />}
            {contact.phone2 && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο 2" value={contact.phone2} />}
            {contact.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={contact.email} />}
            {contact.role && <InfoRow icon={<Tag className="h-4 w-4" />} label="Ρόλος" value={contact.role} />}
            {contact.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Διεύθυνση" value={contact.address} />}
            {contact.vat && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΦΜ" value={contact.vat} />}
            {contact.father_name && <InfoRow icon={<FileText className="h-4 w-4" />} label="Όνομα πατρός" value={contact.father_name} />}
            {contact.mother_name && <InfoRow icon={<FileText className="h-4 w-4" />} label="Όνομα μητρός" value={contact.mother_name} />}
            {contact.birthdate && <InfoRow icon={<FileText className="h-4 w-4" />} label="Ημ/νία γέννησης" value={formatDate(contact.birthdate)} />}
            {contact.amka && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΜΚΑ" value={contact.amka} />}
            {contact.iban && <InfoRow icon={<FileText className="h-4 w-4" />} label="IBAN" value={contact.iban} />}
            {contact.at && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΤ" value={contact.at} />}
            {contact.taxis_username && <InfoRow icon={<FileText className="h-4 w-4" />} label="Taxisnet Username" value={contact.taxis_username} />}
            {contact.taxis_password && <InfoRow icon={<FileText className="h-4 w-4" />} label="Taxisnet Password" value={'•'.repeat(contact.taxis_password.length)} />}
            {contact.notes && (
              <div className="sm:col-span-2 text-sm text-text-secondary bg-white/3 rounded-lg p-3">{contact.notes}</div>
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
