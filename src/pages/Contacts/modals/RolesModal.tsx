import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { fetchContactRoles, createContactRole, deleteContactRole, updateContactRoleColor } from '../../../lib/roleUtils';
import type { ContactRole } from '../../../lib/roleUtils';

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
};

export default function RolesModal({ open, onClose, tenantId }: Props) {
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchContactRoles(tenantId).then(setRoles).finally(() => setLoading(false));
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
      const role = await createContactRole(tenantId, newName.trim(), newColor);
      setRoles(prev => [...prev, role].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewColor(PALETTE[0]);
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

  const handleColorChange = async (id: string, color: string) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, color } : r));
    setEditingColor(null);
    await updateContactRoleColor(id, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <h2 className="text-base font-semibold text-text-primary">Ρόλοι Επαφών</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Add new */}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Νέος ρόλος…"
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
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="h-5 w-5 rounded-full cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
              <span className="text-xs text-text-secondary ml-1">Χρώμα</span>
            </div>
          </form>
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Role list */}
          {loading ? (
            <p className="text-sm text-text-secondary">Φόρτωση…</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-text-secondary">Δεν υπάρχουν ρόλοι ακόμα.</p>
          ) : (
            <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10 max-h-72 overflow-y-auto">
              {roles.map(role => (
                <div key={role.id} className="space-y-0">
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingColor(editingColor === role.id ? null : role.id)}
                        className="h-4 w-4 rounded-full shrink-0 cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: role.color }}
                        title="Αλλαγή χρώματος"
                      />
                      <span className="text-sm text-text-primary">{role.name}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(role.id)}
                      disabled={deleting === role.id}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingColor === role.id && (
                    <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap bg-white/3">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleColorChange(role.id, c)}
                          className="h-5 w-5 rounded-full cursor-pointer transition-transform hover:scale-110"
                          style={{ backgroundColor: c, outline: role.color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
