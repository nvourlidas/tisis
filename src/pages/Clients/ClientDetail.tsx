import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, FileText, Pencil, Check, X, Plus, Search, Users, ExternalLink } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { fetchClient, updateClient } from './clientUtils';
import { createCase } from '../Cases/caseUtils';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth';
import type { Client } from './types';
import type { CaseFormData } from '../Cases/types';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import NewCaseModal from '../Cases/modals/NewCaseModal';

type CaseSummary = { id: string; code: string; title: string; status: string; next_critical_date: string | null };

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
    render: (c) => <span className="text-text-primary">{c.title}</span>,
    sortValue: (c) => c.title,
  },
  {
    key: 'status',
    header: 'Κατάσταση',
    render: (c) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-border/20 text-text-secondary'}`}>
        {STATUS_LABELS[c.status] ?? c.status}
      </span>
    ),
    sortValue: (c) => c.status,
  },
  {
    key: 'next_critical_date',
    header: 'Επόμενη Ημ/νία',
    render: (c) => (
      <span className="text-text-secondary text-xs">
        {c.next_critical_date
          ? formatDate(c.next_critical_date)
          : '—'}
      </span>
    ),
    sortValue: (c) => c.next_critical_date ?? '',
    defaultVisible: false,
  },
];

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
  const [caseSearch, setCaseSearch] = useState('');
  const [showNewCase, setShowNewCase] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchClient(id),
      supabase.from('cases').select('id, code, title, status, next_critical_date').eq('client_id', id).order('created_at', { ascending: false }),
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
      .from('cases').select('id, code, title, status, next_critical_date')
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
        name: form.name, phone: form.phone ?? '', phone2: form.phone2 ?? '',
        email: form.email ?? '', vat: form.vat ?? '', address: form.address ?? '',
        professional_status: form.professional_status ?? '', notes: form.notes ?? '',
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

  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!client) return <div className="p-6 text-sm text-text-secondary">Ο εντολέας δεν βρέθηκε.</div>;

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate('/clients')} className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
        <ArrowLeft className="h-4 w-4" />
        Εντολείς
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

      {client.contact_id && (
        <div className="flex items-center gap-3 rounded-xl border border-border/10 bg-white/3 px-4 py-3">
          <Users className="h-4 w-4 text-text-secondary shrink-0" />
          <span className="text-sm text-text-secondary">Αυτός ο εντολέας έχει συνδεδεμένη επαφή.</span>
          <button
            onClick={() => navigate(`/contacts/${client.contact_id}`)}
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-primary hover:underline cursor-pointer"
          >
            Προβολή επαφής <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
              ['father_name', 'Όνομα πατρός'],
              ['mother_name', 'Όνομα μητρός'],
              ['amka', 'ΑΜΚΑ'],
              ['iban', 'IBAN'],
              ['at', 'ΑΤ (Αστυνομική Ταυτότητα)'],
              ['taxis_username', 'Taxisnet Username'],
            ] as [keyof Client, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs text-text-secondary mb-1">{label}</label>
                <input className="input w-full" value={(form[k] as string) ?? ''} onChange={set(k)} />
              </div>
            ))}
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
            {client.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο" value={client.phone} />}
            {client.phone2 && <InfoRow icon={<Phone className="h-4 w-4" />} label="Τηλέφωνο 2" value={client.phone2} />}
            {client.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />}
            {client.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Διεύθυνση" value={client.address} />}
            {client.vat && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΦΜ" value={client.vat} />}
            {client.father_name && <InfoRow icon={<FileText className="h-4 w-4" />} label="Όνομα πατρός" value={client.father_name} />}
            {client.mother_name && <InfoRow icon={<FileText className="h-4 w-4" />} label="Όνομα μητρός" value={client.mother_name} />}
            {client.birthdate && <InfoRow icon={<FileText className="h-4 w-4" />} label="Ημ/νία γέννησης" value={formatDate(client.birthdate)} />}
            {client.amka && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΜΚΑ" value={client.amka} />}
            {client.iban && <InfoRow icon={<FileText className="h-4 w-4" />} label="IBAN" value={client.iban} />}
            {client.at && <InfoRow icon={<FileText className="h-4 w-4" />} label="ΑΤ" value={client.at} />}
            {client.taxis_username && <InfoRow icon={<FileText className="h-4 w-4" />} label="Taxisnet Username" value={client.taxis_username} />}
            {client.taxis_password && <InfoRow icon={<FileText className="h-4 w-4" />} label="Taxisnet Password" value={'•'.repeat(client.taxis_password.length)} />}
            {client.notes && (
              <div className="sm:col-span-2 text-sm text-text-secondary bg-white/3 rounded-lg p-3">{client.notes}</div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-text-primary">Υποθέσεις ({cases.length})</h2>
          <button
            onClick={() => setShowNewCase(true)}
            className="btn-primary inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Νέα Υπόθεση
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            className="input w-full pl-9!"
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
            <p className="text-sm text-text-secondary">
              {caseSearch ? 'Δεν βρέθηκαν υποθέσεις.' : 'Δεν υπάρχουν υποθέσεις ακόμα.'}
            </p>
          }
        />
      </div>

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
