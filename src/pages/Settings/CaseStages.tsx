import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchStages, createStage, deleteStage } from '../Cases/caseUtils';
import type { CaseStage } from '../Cases/types';

export default function CaseStages() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [stages, setStages] = useState<CaseStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchStages(tenantId).then(setStages).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createStage(tenantId, newName.trim(), stages.length);
      setNewName('');
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας σταδίου.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteStage(id);
      setStages(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία διαγραφής.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Στάδια Υποθέσεων</h1>
        <p className="text-sm text-text-secondary mt-1">
          Διαχειριστείτε τα στάδια που εμφανίζονται κατά τη δημιουργία ή επεξεργασία υπόθεσης.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Νέο στάδιο (π.χ. Α΄ Βαθμός, Εφετείο…)"
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

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : stages.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν στάδια ακόμα.</p>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center justify-between px-4 py-3 bg-secondary-background hover:bg-white/3 transition-colors">
              <span className="text-sm text-text-primary">{stage.name}</span>
              <button
                onClick={() => handleDelete(stage.id)}
                disabled={deleting === stage.id}
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
