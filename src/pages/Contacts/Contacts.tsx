import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchContacts, createContact, searchContacts } from './contactUtils';
import type { Contact, ContactFormData } from './types';
import NewContactModal from './modals/NewContactModal';

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
          className="input w-full pl-9"
          placeholder="Αναζήτηση με όνομα, τηλέφωνο ή email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{query ? 'Δεν βρέθηκαν επαφές.' : 'Δεν υπάρχουν επαφές ακόμα.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Όνομα</th>
                <th className="text-left px-4 py-3 font-medium">Ρόλος</th>
                <th className="text-left px-4 py-3 font-medium">Τηλέφωνο</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  className="hover:bg-white/3 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.role ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{c.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewContactModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
    </div>
  );
}
