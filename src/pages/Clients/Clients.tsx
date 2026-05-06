import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, User, RotateCcw } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchClients, createClient, searchClients } from './clientUtils';
import type { Client, ClientFormData } from './types';
import NewClientModal from './modals/NewClientModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';

const COLUMNS: ColumnDef<Client>[] = [
  {
    key: 'name',
    header: 'Όνομα',
    render: (c) => <span className="font-semibold text-text-primary">{c.name}</span>,
    sortValue: (c) => c.name,
  },
  {
    key: 'phone',
    header: 'Τηλέφωνο',
    render: (c) => <span className="text-text-secondary font-mono">{c.phone ?? '—'}</span>,
    sortValue: (c) => c.phone ?? '',
  },
  {
    key: 'email',
    header: 'Email',
    render: (c) => <span className="text-text-secondary">{c.email ?? '—'}</span>,
    sortValue: (c) => c.email ?? '',
  },
  {
    key: 'professional_status',
    header: 'Ιδιότητα',
    render: (c) => c.professional_status
      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{c.professional_status}</span>
      : <span className="text-text-secondary">—</span>,
    sortValue: (c) => c.professional_status ?? '',
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

export default function Clients() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    fetchClients(tenantId).then(setClients).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (!query.trim()) {
      fetchClients(tenantId).then(setClients);
      return;
    }
    const t = setTimeout(() => {
      searchClients(tenantId, query.trim()).then(setClients);
    }, 250);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const handleCreate = async (data: ClientFormData) => {
    const created = await createClient(tenantId, data);
    navigate(`/clients/${created.id}`);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Εντολείς</h1>
          <p className="text-sm text-text-secondary mt-0.5">{clients.length} εντολείς</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Νέος Εντολέας
        </button>
      </div>

      {/* Search */}
      <div className="animate-fade-in-up stagger-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          className="input rounded-xl border-border/15 hover:border-border/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors w-full pl-9!"
          placeholder="Αναζήτηση με όνομα, τηλέφωνο ή email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Φόρτωση εντολέων…
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2">
          <DataTable
            tableId="clients"
            columns={COLUMNS}
            data={clients}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/clients/${c.id}`)}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
                <div className="w-14 h-14 rounded-2xl bg-border/5 flex items-center justify-center">
                  <User className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm">{query ? 'Δεν βρέθηκαν εντολείς.' : 'Δεν υπάρχουν εντολείς ακόμα.'}</p>
                {!query && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs text-primary hover:underline cursor-pointer font-medium"
                  >
                    Δημιουργήστε τον πρώτο εντολέα →
                  </button>
                )}
              </div>
            }
          />
        </div>
      )}

      <NewClientModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
    </div>
  );
}
