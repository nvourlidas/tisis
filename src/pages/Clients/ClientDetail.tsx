import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Pencil, Check, X,
  Plus, Search, User, RotateCcw, CreditCard,
  ShieldCheck, KeyRound, CalendarDays, Trash2,
} from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { fetchClient, updateClient, deleteClient } from './clientUtils';
import { createCase } from '../Cases/caseUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth';
import type { Client } from './types';
import type { CaseFormData } from '../Cases/types';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import NewCaseModal from '../Cases/modals/NewCaseModal';
import CaseEmails from '../Cases/components/CaseEmails';

type CaseSummary = { id: string; code: string; title: string; status: string; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  active:  'Ενεργή',
  pending: 'Εκκρεμής',
  closed:  'Κλειστή',
};

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-green-500/15 text-green-500',
  pending: 'bg-yellow-500/15 text-yellow-600',
  closed:  'bg-border/10 text-text-secondary',
};

const STATUS_DOT: Record<string, string> = {
  active:  'bg-green-500',
  pending: 'bg-yellow-500',
  closed:  'bg-text-secondary/40',
};

const CASE_COLUMNS: ColumnDef<CaseSummary>[] = [
  {
    key: 'code',
    header: 'Κωδικός',
    render: (c) => <span className="font-mono text-xs text-text-secondary">{c.code}</span>,
    sortValue: (c) => c.code,
  },
  {
    key: 'title',
    header: 'Τίτλος',
    render: (c) => <span className="font-medium text-text-primary">{c.title}</span>,
    sortValue: (c) => c.title,
  },
  {
    key: 'status',
    header: 'Κατάσταση',
    render: (c) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-border/10 text-text-secondary'}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? ''}`} />
        {STATUS_LABELS[c.status] ?? c.status}
      </span>
    ),
    sortValue: (c) => c.status,
  },
  {
    key: 'created_at',
    header: 'Ημ/νία Δημιουργίας',
    render: (c) => <span className="text-text-secondary text-xs">{formatDate(c.created_at)}</span>,
    sortValue: (c) => c.created_at,
    defaultVisible: true,
  },
];

// Map field keys to icon + color for the info cards
const FIELD_META: Partial<Record<keyof Client, { icon: React.ReactNode; color: string; bg: string }>> = {
  phone:             { icon: <Phone className="h-4 w-4" />,       color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  phone2:            { icon: <Phone className="h-4 w-4" />,       color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  phone3:            { icon: <Phone className="h-4 w-4" />,       color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  phone4:            { icon: <Phone className="h-4 w-4" />,       color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  email:             { icon: <Mail className="h-4 w-4" />,        color: 'text-purple-500', bg: 'bg-purple-500/10' },
  email2:            { icon: <Mail className="h-4 w-4" />,        color: 'text-purple-400', bg: 'bg-purple-400/10' },
  email3:            { icon: <Mail className="h-4 w-4" />,        color: 'text-purple-400', bg: 'bg-purple-400/10' },
  email4:            { icon: <Mail className="h-4 w-4" />,        color: 'text-purple-400', bg: 'bg-purple-400/10' },
  address:           { icon: <MapPin className="h-4 w-4" />,      color: 'text-green-500',  bg: 'bg-green-500/10' },
  vat:               { icon: <FileText className="h-4 w-4" />,    color: 'text-orange-500', bg: 'bg-orange-500/10' },
  father_name:       { icon: <User className="h-4 w-4" />,        color: 'text-text-secondary', bg: 'bg-border/5' },
  mother_name:       { icon: <User className="h-4 w-4" />,        color: 'text-text-secondary', bg: 'bg-border/5' },
  birthdate:         { icon: <CalendarDays className="h-4 w-4" />, color: 'text-teal-500',  bg: 'bg-teal-500/10' },
  amka:              { icon: <ShieldCheck className="h-4 w-4" />, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  iban:              { icon: <CreditCard className="h-4 w-4" />,  color: 'text-green-600',  bg: 'bg-green-600/10' },
  at:                { icon: <ShieldCheck className="h-4 w-4" />, color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  taxis_username:    { icon: <KeyRound className="h-4 w-4" />,    color: 'text-text-secondary', bg: 'bg-border/5' },
  taxis_password:    { icon: <KeyRound className="h-4 w-4" />,    color: 'text-text-secondary', bg: 'bg-border/5' },
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [client, setClient] = useState<Client | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'cases' | 'emails'>('info');
  const [caseSearch, setCaseSearch] = useState('');
  const [showNewCase, setShowNewCase] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchClient(id),
      supabase.from('cases').select('id, code, title, status, created_at').eq('client_id', id).order('created_at', { ascending: false }),
    ]).then(([c, { data: caseData }]) => {
      setClient(c);
      setForm(c ?? {});
      setCases(caseData ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  }, [cases, caseSearch]);

  const handleNewCase = async (data: CaseFormData) => {
    const created = await createCase(tenantId, data);
    const { data: caseData } = await supabase
      .from('cases').select('id, code, title, status, created_at')
      .eq('client_id', id).order('created_at', { ascending: false });
    setCases(caseData ?? []);
    navigate(`/cases/${created.id}`);
  };

  const startEdit = () => { setForm(client ?? {}); setEditing(true); setError(null); };
  const cancelEdit = () => { setEditing(false); setError(null); };

  const saveEdit = async () => {
    if (!id || !form.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateClient(id, {
        name: form.name,
        phone: form.phone ?? '', phone2: form.phone2 ?? '', phone3: form.phone3 ?? '', phone4: form.phone4 ?? '',
        email: form.email ?? '', email2: form.email2 ?? '', email3: form.email3 ?? '', email4: form.email4 ?? '',
        vat: form.vat ?? '', address: form.address ?? '',
        job_title: form.job_title ?? '', organization: form.organization ?? '', website: form.website ?? '',
        notes: form.notes ?? '',
        father_name: form.father_name ?? '', mother_name: form.mother_name ?? '',
        birthdate: form.birthdate ?? '', amka: form.amka ?? '', iban: form.iban ?? '',
        at: form.at ?? '', taxis_username: form.taxis_username ?? '', taxis_password: form.taxis_password ?? '',
      });
      setClient((prev) => prev ? { ...prev, ...form } : prev);
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
    try {
      await deleteClient(id);
      navigate('/clients');
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία διαγραφής.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return (
    <div className="p-6 flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft">
      <RotateCcw className="h-4 w-4 animate-spin" />
      Φόρτωση εντολέα…
    </div>
  );
  if (!client) return (
    <div className="p-6 flex items-center gap-3 text-sm text-text-secondary">
      <User className="h-4 w-4 opacity-40" />
      Ο εντολέας δεν βρέθηκε.
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/clients')}
        className="animate-fade-in inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Εντολείς
      </button>

      {/* Header card */}
      <div className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              {editing ? (
                <input
                  className="input text-xl font-bold w-full max-w-sm rounded-xl border-border/15"
                  value={form.name ?? ''}
                  onChange={set('name')}
                  required
                />
              ) : (
                <h1 className="text-xl font-bold text-text-primary leading-tight">{client.name}</h1>
              )}
              {client.job_title && !editing && (
                <span className="inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {client.job_title}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
                  <X className="h-3.5 w-3.5" />Ακύρωση
                </button>
                <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" />{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-danger/20 text-sm text-danger hover:bg-danger/5 transition-all cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />Διαγραφή
                </button>
                <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
                  <Pencil className="h-3.5 w-3.5" />Επεξεργασία
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up flex gap-1 border-b border-border/10">
        {([['info', 'Στοιχεία'], ['cases', `Υποθέσεις${cases.length > 0 ? ` (${cases.length})` : ''}`], ['emails', 'Email']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditing(false); setError(null); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-2 animate-fade-in">
          {error}
        </p>
      )}

      {/* Info tab */}
      {activeTab === 'info' && <div className="animate-fade-in-up stagger-1">
        {editing ? (
          <div className="rounded-xl border border-border/10 bg-secondary-background p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['phone',           'Τηλέφωνο'],
              ['phone2',          'Τηλέφωνο 2'],
              ['phone3',          'Τηλέφωνο 3'],
              ['phone4',          'Τηλέφωνο 4'],
              ['email',           'Email'],
              ['email2',          'Email 2'],
              ['email3',          'Email 3'],
              ['email4',          'Email 4'],
              ['vat',             'ΑΦΜ'],
              ['job_title',       'Ιδιότητα / Επάγγελμα'],
              ['organization',    'Οργανισμός / Εταιρεία'],
              ['website',         'Website'],
              ['address',         'Διεύθυνση'],
              ['father_name',     'Όνομα πατρός'],
              ['mother_name',     'Όνομα μητρός'],
              ['amka',            'ΑΜΚΑ'],
              ['iban',            'IBAN'],
              ['at',              'ΑΤ (Αστυνομική Ταυτότητα)'],
              ['taxis_username',  'Taxisnet Username'],
            ] as [keyof Client, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
                <input className="input w-full rounded-xl border-border/15" value={(form[k] as string) ?? ''} onChange={set(k)} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Taxisnet Password</label>
              <input className="input w-full rounded-xl border-border/15" value={(form.taxis_password as string) ?? ''} onChange={set('taxis_password')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Ημ/νία γέννησης</label>
              <input className="input w-full rounded-xl border-border/15" type="date" value={(form.birthdate as string) ?? ''} onChange={set('birthdate')} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Σημειώσεις</label>
              <textarea className="input w-full rounded-xl border-border/15 resize-none" rows={3} value={(form.notes as string) ?? ''} onChange={set('notes')} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ['phone',          'Τηλέφωνο',             client.phone],
                  ['phone2',         'Τηλέφωνο 2',           client.phone2],
                  ['phone3',         'Τηλέφωνο 3',           client.phone3],
                  ['phone4',         'Τηλέφωνο 4',           client.phone4],
                  ['email',          'Email',                 client.email],
                  ['email2',         'Email 2',               client.email2],
                  ['email3',         'Email 3',               client.email3],
                  ['email4',         'Email 4',               client.email4],
                  ['address',        'Διεύθυνση',             client.address],
                  ['vat',            'ΑΦΜ',                   client.vat],
                  ['job_title',      'Ιδιότητα / Επάγγελμα', client.job_title],
                  ['organization',   'Οργανισμός / Εταιρεία', client.organization],
                  ['website',        'Website',               client.website],
                  ['father_name',    'Όνομα πατρός',          client.father_name],
                  ['mother_name',    'Όνομα μητρός',          client.mother_name],
                  ['birthdate',      'Ημ/νία γέννησης',       client.birthdate ? formatDate(client.birthdate) : null],
                  ['amka',           'ΑΜΚΑ',                  client.amka],
                  ['iban',           'IBAN',                  client.iban],
                  ['at',             'ΑΤ',                    client.at],
                  ['taxis_username', 'Taxisnet Username',     client.taxis_username],
                  ['taxis_password', 'Taxisnet Password',     client.taxis_password ?? null],
                ] as [keyof Client, string, string | null | undefined][]
              ).filter(([, , v]) => !!v).map(([k, label, value]) => {
                const meta = FIELD_META[k];
                return (
                  <div key={k} className="flex items-center gap-3 rounded-xl border border-border/10 bg-background p-3.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta?.bg ?? 'bg-border/5'} ${meta?.color ?? 'text-text-secondary'}`}>
                      {meta?.icon ?? <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-text-secondary mb-0.5">{label}</div>
                      <div className="text-sm font-medium text-text-primary truncate">{value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {client.notes && (
              <div className="border-t border-border/10 pt-4">
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Σημειώσεις</div>
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Emails tab */}
      {activeTab === 'emails' && <div className="animate-fade-in-up stagger-1"><CaseEmails clientEmail={client.email} /></div>}

      {/* Cases tab */}
      {activeTab === 'cases' && <div className="animate-fade-in-up stagger-1 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Υποθέσεις</h2>
            {cases.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {cases.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowNewCase(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Νέα Υπόθεση
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            className="input rounded-xl border-border/15 hover:border-border/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors w-full pl-9!"
            placeholder="Αναζήτηση με κωδικό ή τίτλο…"
            value={caseSearch}
            onChange={(e) => setCaseSearch(e.target.value)}
          />
        </div>

        <DataTable
          tableId="client-detail-cases"
          columns={CASE_COLUMNS}
          data={filteredCases}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/cases/${c.id}`)}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-8 text-text-secondary">
              <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
                <FileText className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm">{caseSearch ? 'Δεν βρέθηκαν υποθέσεις.' : 'Δεν υπάρχουν υποθέσεις ακόμα.'}</p>
              {!caseSearch && (
                <button onClick={() => setShowNewCase(true)} className="text-xs text-primary hover:underline cursor-pointer font-medium">
                  Δημιουργήστε την πρώτη υπόθεση →
                </button>
              )}
            </div>
          }
        />
      </div>}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-secondary-background rounded-2xl border border-border/15 shadow-xl p-6 w-full max-w-sm mx-4 space-y-4 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Διαγραφή εντολέα;</h2>
                <p className="text-sm text-text-secondary mt-0.5">Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">
              Πρόκειται να διαγράψετε τον εντολέα <span className="font-semibold text-text-primary">{client.name}</span>.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer disabled:opacity-60">
                Ακύρωση
              </button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-all cursor-pointer disabled:opacity-60">
                {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}

      <NewCaseModal
        open={showNewCase}
        onClose={() => setShowNewCase(false)}
        onSubmit={handleNewCase}
        tenantId={tenantId}
        defaultClientId={id}
      />
    </div>
  );
}
