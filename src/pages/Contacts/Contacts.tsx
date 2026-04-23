import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchContacts, createContact, searchContacts } from './contactUtils';
import type { Contact, ContactFormData } from './types';
import NewContactModal from './modals/NewContactModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';

const COLUMNS: ColumnDef<Contact>[] = [
  {
    key: 'name',
    header: 'Όνομα',
    render: (c) => <span className="font-medium text-text-primary">{c.name}</span>,
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
];

export default function Contacts() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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

  const handleCreate = async (data: ContactFormData) => {
    const created = await createContact(tenantId, data);
    navigate(`/contacts/${created.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Επαφές</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Νέα Επαφή
        </button>
      </div>

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

      <NewContactModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
    </div>
  );
}
