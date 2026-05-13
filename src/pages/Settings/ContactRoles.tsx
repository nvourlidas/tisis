import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchContactRoles, createContactRole, deleteContactRole } from '../../lib/roleUtils';
import type { ContactRole } from '../../lib/roleUtils';

export default function ContactRoles() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchContactRoles(tenantId).then(setRoles).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createContactRole(tenantId, newName.trim(), '#6b7280');
      setNewName('');
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας ρόλου.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteContactRole(id);
      setRoles(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Ρόλοι Επαφών</h1>
        <p className="text-sm text-text-secondary mt-1">
          Διαχειριστείτε τους ρόλους που εμφανίζονται κατά τη δημιουργία επαφής.
        </p>
      </div>

      {/* Add new role */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Νέος ρόλος (π.χ. Αντίδικος, Μάρτυρας…)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving || !newName.trim()}
          className="btn-primary inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Προσθήκη
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Role list */}
      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : roles.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν ρόλοι ακόμα.</p>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
          {roles.map(role => (
            <div key={role.id} className="flex items-center justify-between px-4 py-3 bg-secondary-background hover:bg-white/3 transition-colors">
              <span className="text-sm text-text-primary">{role.name}</span>
              <button
                onClick={() => handleDelete(role.id)}
                disabled={deleting === role.id}
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
