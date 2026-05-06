import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Tag, FileText, MapPin, Pencil, Check, X,
  UserCheck, ExternalLink, Trash2, Users, CalendarDays, ShieldCheck,
  CreditCard, KeyRound, RotateCcw, Briefcase,
} from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchContact, fetchContactCases, updateContact, deleteContact, fetchLinkedClient, promoteContactToClient } from './contactUtils';
import { fetchContactRoles } from '../../lib/roleUtils';
import type { Contact, ContactCase } from './types';
import type { Client } from '../Clients/types';
import type { ContactRole } from '../../lib/roleUtils';
import RoleSelect from '../../components/RoleSelect';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ενεργή',
  pending: 'Εκκρεμής',
  closed: 'Κλειστή',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  pending: 'bg-yellow-500',
  closed: 'bg-border',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-500',
  pending: 'bg-yellow-500/10 text-yellow-500',
  closed: 'bg-border/20 text-text-secondary',
};

type FieldMeta = { icon: React.ReactNode; color: string; bg: string };

const FIELD_META: Record<string, FieldMeta> = {
  phone:               { icon: <Phone className="h-4 w-4" />,        color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  phone2:              { icon: <Phone className="h-4 w-4" />,        color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  email:               { icon: <Mail className="h-4 w-4" />,         color: 'text-purple-500', bg: 'bg-purple-500/10' },
  address:             { icon: <MapPin className="h-4 w-4" />,       color: 'text-green-500',  bg: 'bg-green-500/10' },
  vat:                 { icon: <FileText className="h-4 w-4" />,     color: 'text-orange-500', bg: 'bg-orange-500/10' },
  professional_status: { icon: <Briefcase className="h-4 w-4" />,   color: 'text-teal-500',   bg: 'bg-teal-500/10' },
  father_name:         { icon: <Users className="h-4 w-4" />,        color: 'text-slate-400',  bg: 'bg-slate-400/10' },
  mother_name:         { icon: <Users className="h-4 w-4" />,        color: 'text-slate-400',  bg: 'bg-slate-400/10' },
  birthdate:           { icon: <CalendarDays className="h-4 w-4" />, color: 'text-teal-500',   bg: 'bg-teal-500/10' },
  amka:                { icon: <ShieldCheck className="h-4 w-4" />,  color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  iban:                { icon: <CreditCard className="h-4 w-4" />,   color: 'text-green-500',  bg: 'bg-green-500/10' },
  at:                  { icon: <ShieldCheck className="h-4 w-4" />,  color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  taxis_username:      { icon: <KeyRound className="h-4 w-4" />,     color: 'text-gray-400',   bg: 'bg-gray-400/10' },
  taxis_password:      { icon: <KeyRound className="h-4 w-4" />,     color: 'text-gray-400',   bg: 'bg-gray-400/10' },
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
  const [roles, setRoles] = useState<ContactRole[]>([]);

  useEffect(() => {
    if (!id || !tenantId) return;
    setLoading(true);
    Promise.all([fetchContact(id), fetchContactCases(id), fetchContactRoles(tenantId)])
      .then(([c, cc, r]) => {
        setContact(c);
        setForm(c ?? {});
        setCases(cc);
        setRoles(r);
        if (c?.is_client) fetchLinkedClient(id).then(setLinkedClient);
      })
      .finally(() => setLoading(false));
  }, [id, tenantId]);

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

  if (loading) return (
    <div className="flex items-center gap-3 p-8 text-sm text-text-secondary animate-pulse-soft">
      <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση επαφής…
    </div>
  );
  if (!contact) return <div className="p-6 text-sm text-text-secondary">Η επαφή δεν βρέθηκε.</div>;

  const currentRole = roles.find(r => r.name === contact.role);

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/contacts')}
        className="animate-fade-in inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Επαφές
      </button>

      {/* Header card */}
      <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              {editing ? (
                <input
                  className="input text-xl font-bold w-full max-w-sm"
                  value={form.name ?? ''}
                  onChange={set('name')}
                  required
                />
              ) : (
                <h1 className="text-xl font-bold text-text-primary">{contact.name}</h1>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {contact.is_client && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                    Εντολέας
                  </span>
                )}
                {currentRole && !editing && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: currentRole.color + '25', color: currentRole.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: currentRole.color }} />
                    {contact.role}
                  </span>
                )}
                {contact.is_client && linkedClient && (
                  <button
                    onClick={() => navigate(`/clients/${linkedClient.id}`)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                  >
                    Προβολή εντολέα <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!editing && !contact.is_client && (
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary border border-border/15 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
              >
                {promoting ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                {promoting ? 'Μετατροπή…' : 'Μετατροπή σε Εντολέα'}
              </button>
            )}
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary border border-border/15 hover:border-border/30 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Ακύρωση
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </>
            ) : confirmDelete ? (
              <>
                <span className="text-sm text-text-secondary">Σίγουρα;</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary border border-border/15 hover:border-border/30 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Ακύρωση
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Διαγραφή
                </button>
                <button
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary border border-border/15 hover:border-border/30 hover:text-text-primary transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" /> Επεξεργασία
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="animate-fade-in rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Info */}
      <div className="animate-fade-in-up stagger-1 rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <input className="input w-full" value={(form.taxis_password as string) ?? ''} onChange={set('taxis_password')} />
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contact.role && (() => {
                const role = roles.find(r => r.name === contact.role);
                return role ? (
                  <InfoCard
                    icon={<Tag className="h-4 w-4" />}
                    iconColor="text-primary"
                    iconBg="bg-primary/10"
                    label="Ρόλος"
                    value={
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: role.color + '25', color: role.color }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                        {contact.role}
                      </span>
                    }
                  />
                ) : (
                  <InfoCard {...FIELD_META.taxis_username} label="Ρόλος" value={<span className="text-sm text-text-primary">{contact.role}</span>} />
                );
              })()}
              {([
                ['phone', 'Τηλέφωνο', contact.phone],
                ['phone2', 'Τηλέφωνο 2', contact.phone2],
                ['email', 'Email', contact.email],
                ['address', 'Διεύθυνση', contact.address],
                ['vat', 'ΑΦΜ', contact.vat],
                ['professional_status', 'Επαγγελματική Ιδιότητα', contact.professional_status],
                ['father_name', 'Όνομα πατρός', contact.father_name],
                ['mother_name', 'Όνομα μητρός', contact.mother_name],
                ['birthdate', 'Ημ/νία γέννησης', contact.birthdate ? formatDate(contact.birthdate) : null],
                ['amka', 'ΑΜΚΑ', contact.amka],
                ['iban', 'IBAN', contact.iban],
                ['at', 'ΑΤ', contact.at],
                ['taxis_username', 'Taxisnet Username', contact.taxis_username],
                ['taxis_password', 'Taxisnet Password', contact.taxis_password],
              ] as [string, string, string | null | undefined][]).map(([key, label, val]) =>
                val ? (
                  <InfoCard
                    key={key}
                    icon={(FIELD_META[key] ?? FIELD_META.vat).icon}
                    iconColor={(FIELD_META[key] ?? FIELD_META.vat).color}
                    iconBg={(FIELD_META[key] ?? FIELD_META.vat).bg}
                    label={label}
                    value={<span className="text-sm text-text-primary">{val}</span>}
                  />
                ) : null
              )}
            </div>
            {contact.notes && (
              <div className="border-t border-border/10 pt-4">
                <p className="text-xs text-text-secondary mb-1">Σημειώσεις</p>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Linked cases */}
      <div className="animate-fade-in-up stagger-2 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Συνδεδεμένες Υποθέσεις
          <span className="ml-2 text-xs font-normal text-text-secondary">({cases.length})</span>
        </h2>
        {cases.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-text-secondary">
            <div className="w-10 h-10 rounded-xl bg-border/5 flex items-center justify-center">
              <Briefcase className="h-5 w-5 opacity-30" />
            </div>
            <p className="text-sm">Η επαφή δεν είναι συνδεδεμένη σε καμία υπόθεση.</p>
          </div>
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
                  <tr
                    key={c.case_id}
                    onClick={() => navigate(`/cases/${c.case_id}`)}
                    className="hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{c.code}</td>
                    <td className="px-4 py-2.5 text-text-primary">{c.title}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status] ?? STATUS_BADGE.closed}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status] ?? 'bg-border'}`} />
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

function InfoCard({
  icon, iconColor, iconBg, label, value,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-background px-3 py-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary mb-0.5">{label}</p>
        {value}
      </div>
    </div>
  );
}
