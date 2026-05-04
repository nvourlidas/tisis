import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchContacts, createContact, searchContacts } from './contactUtils';
import type { Contact, ContactFormData } from './types';
import NewContactModal from './modals/NewContactModal';
import RolesModal from './modals/RolesModal';
import GoogleImportModal from './modals/GoogleImportModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';

const COLUMNS: ColumnDef<Contact>[] = [
  {
    key: 'name',
    header: 'Όνομα',
    render: (c) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-text-primary">{c.name}</span>
        {c.is_client && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">Εντολέας</span>
        )}
      </div>
    ),
    sortValue: (c) => c.name,
  },
  {
    key: 'role',
    header: 'Ρόλος',
    render: (c) => <span className="text-text-secondary">{c.role ?? '—'}</span>,
    sortValue: (c) => c.role ?? '',
  },
  {
    key: 'phone',
    header: 'Τηλέφωνο',
    render: (c) => <span className="text-text-secondary">{c.phone ?? '—'}</span>,
    sortValue: (c) => c.phone ?? '',
  },
  {
    key: 'email',
    header: 'Email',
    render: (c) => <span className="text-text-secondary">{c.email ?? '—'}</span>,
    sortValue: (c) => c.email ?? '',
    defaultVisible: false,
  },
  {
    key: 'phone2',
    header: 'Τηλέφωνο 2',
    render: (c) => <span className="text-text-secondary">{c.phone2 ?? '—'}</span>,
    sortValue: (c) => c.phone2 ?? '',
    defaultVisible: false,
  },
  {
    key: 'vat',
    header: 'ΑΦΜ',
    render: (c) => <span className="text-text-secondary font-mono text-xs">{c.vat ?? '—'}</span>,
    sortValue: (c) => c.vat ?? '',
    defaultVisible: false,
  },
  {
    key: 'professional_status',
    header: 'Ιδιότητα',
    render: (c) => <span className="text-text-secondary">{c.professional_status ?? '—'}</span>,
    sortValue: (c) => c.professional_status ?? '',
    defaultVisible: false,
  },
  {
    key: 'address',
    header: 'Διεύθυνση',
    render: (c) => <span className="text-text-secondary">{c.address ?? '—'}</span>,
    sortValue: (c) => c.address ?? '',
    defaultVisible: false,
  },
  {
    key: 'father_name',
    header: 'Όνομα πατρός',
    render: (c) => <span className="text-text-secondary">{c.father_name ?? '—'}</span>,
    sortValue: (c) => c.father_name ?? '',
    defaultVisible: false,
  },
  {
    key: 'mother_name',
    header: 'Όνομα μητρός',
    render: (c) => <span className="text-text-secondary">{c.mother_name ?? '—'}</span>,
    sortValue: (c) => c.mother_name ?? '',
    defaultVisible: false,
  },
  {
    key: 'birthdate',
    header: 'Ημ/νία γέννησης',
    render: (c) => <span className="text-text-secondary text-xs">{formatDate(c.birthdate)}</span>,
    sortValue: (c) => c.birthdate ?? '',
    defaultVisible: false,
  },
  {
    key: 'amka',
    header: 'ΑΜΚΑ',
    render: (c) => <span className="text-text-secondary font-mono text-xs">{c.amka ?? '—'}</span>,
    sortValue: (c) => c.amka ?? '',
    defaultVisible: false,
  },
  {
    key: 'iban',
    header: 'IBAN',
    render: (c) => <span className="text-text-secondary font-mono text-xs">{c.iban ?? '—'}</span>,
    sortValue: (c) => c.iban ?? '',
    defaultVisible: false,
  },
  {
    key: 'at',
    header: 'ΑΤ',
    render: (c) => <span className="text-text-secondary font-mono text-xs">{c.at ?? '—'}</span>,
    sortValue: (c) => c.at ?? '',
    defaultVisible: false,
  },
  {
    key: 'taxis_username',
    header: 'Taxisnet Username',
    render: (c) => <span className="text-text-secondary">{c.taxis_username ?? '—'}</span>,
    sortValue: (c) => c.taxis_username ?? '',
    defaultVisible: false,
  },
];

export default function Contacts() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showGoogleImport, setShowGoogleImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    fetchContacts(tenantId).then(setContacts).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (!query.trim()) {
      fetchContacts(tenantId).then(setContacts);
      return;
    }
    const t = setTimeout(() => {
      searchContacts(tenantId, query.trim()).then(setContacts);
    }, 250);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const handleGooglePull = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('google-contact-sync', {
        body: { action: 'pull' },
      });
      if (error) throw error;
      setSyncResult(data.updated === 0
        ? 'Δεν βρέθηκαν αλλαγές.'
        : `Ενημερώθηκαν ${data.updated} επαφές από Google.`);
      if (data.updated > 0) fetchContacts(tenantId).then(setContacts);
    } catch (e: any) {
      setSyncResult('Αποτυχία συγχρονισμού: ' + (e.message ?? 'Άγνωστο σφάλμα'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
  };

  const handleCreate = async (data: ContactFormData) => {
    const created = await createContact(tenantId, data);
    navigate(`/contacts/${created.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Επαφές</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRoles(true)} className="btn-secondary cursor-pointer">
            Ρόλοι
          </button>
          <button onClick={handleGooglePull} disabled={syncing} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Συγχρονισμός…' : 'Sync από Google'}
          </button>
          <button onClick={() => setShowGoogleImport(true)} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
            <svg viewBox="0 0 24 24" width="14" height="14" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Εισαγωγή από Google
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="h-4 w-4" />
            Νέα Επαφή
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`text-sm px-4 py-2.5 rounded-lg ${syncResult.startsWith('Αποτυχία') ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
          {syncResult}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          className="input w-full pl-9!"
          placeholder="Αναζήτηση με όνομα, τηλέφωνο ή email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : (
        <DataTable
          tableId="contacts"
          columns={COLUMNS}
          data={contacts}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/contacts/${c.id}`)}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">{query ? 'Δεν βρέθηκαν επαφές.' : 'Δεν υπάρχουν επαφές ακόμα.'}</p>
            </div>
          }
        />
      )}

      <NewContactModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} tenantId={tenantId} />
      <RolesModal open={showRoles} onClose={() => setShowRoles(false)} tenantId={tenantId} />
      <GoogleImportModal
        open={showGoogleImport}
        onClose={() => setShowGoogleImport(false)}
        onImported={() => {
          setShowGoogleImport(false);
          fetchContacts(tenantId).then(setContacts);
        }}
      />
    </div>
  );
}
