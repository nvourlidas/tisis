import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { fetchStages, createStage, deleteStage } from '../caseUtils';
import type { CaseStage } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
};

export default function StagesModal({ open, onClose, tenantId }: Props) {
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchStages(tenantId).then(setStages).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open && tenantId) load();
  }, [open, tenantId]);

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <h2 className="text-base font-semibold text-text-primary">Στάδια Υποθέσεων</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Νέο στάδιο…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="btn-primary inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Προσθήκη
            </button>
          </form>
          {error && <p className="text-sm text-danger">{error}</p>}

          {loading ? (
            <p className="text-sm text-text-secondary">Φόρτωση…</p>
          ) : stages.length === 0 ? (
            <p className="text-sm text-text-secondary">Δεν υπάρχουν στάδια ακόμα.</p>
          ) : (
            <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10 max-h-72 overflow-y-auto">
              {stages.map(stage => (
                <div key={stage.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors">
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
      </div>
    </div>
  );
}
