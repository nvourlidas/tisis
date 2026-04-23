import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fetchClients } from '../../Clients/clientUtils';
import type { Client } from '../../Clients/types';
import type { CaseFormData } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CaseFormData) => Promise<void>;
  tenantId: string;
  defaultClientId?: string;
};

const empty: CaseFormData = {
  code: '', title: '', client_id: '', status: 'active',
  stage: '', description: '', next_critical_date: '', google_drive_url: '', notes: '',
};

export default function NewCaseModal({ open, onClose, onSubmit, tenantId, defaultClientId }: Props) {
  const [form, setForm] = useState<CaseFormData>({ ...empty, client_id: defaultClientId ?? '' });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...empty, client_id: defaultClientId ?? '' });
      if (tenantId && !defaultClientId) fetchClients(tenantId).then(setClients);
    }
  }, [open, tenantId, defaultClientId]);

  if (!open) return null;

  const set = (k: keyof CaseFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(form);
      setForm(empty);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας υπόθεσης.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <h2 className="text-base font-semibold text-text-primary">Νέα Υπόθεση</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                Κωδικός <span className="text-danger">*</span>
              </label>
              <input
                className="input w-full"
                value={form.code}
                onChange={set('code')}
                required
                autoFocus
                placeholder="π.χ. Α60α"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Κατάσταση</label>
              <select className="input w-full" value={form.status} onChange={set('status')}>
                <option value="active">Ενεργή</option>
                <option value="pending">Εκκρεμής</option>
                <option value="closed">Κλειστή</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Τίτλος <span className="text-danger">*</span>
            </label>
            <input className="input w-full" value={form.title} onChange={set('title')} required />
          </div>

          {!defaultClientId && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Πελάτης</label>
              <select className="input w-full" value={form.client_id} onChange={set('client_id')}>
                <option value="">— Χωρίς πελάτη —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1">Επόμενη Κρίσιμη Ημερομηνία</label>
            <input
              className="input w-full"
              type="date"
              value={form.next_critical_date}
              onChange={set('next_critical_date')}
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Περιγραφή</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={form.description}
              onChange={set('description')}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary cursor-pointer">
              Ακύρωση
            </button>
            <button type="submit" disabled={loading} className="btn-primary cursor-pointer">
              {loading ? 'Αποθήκευση…' : 'Δημιουργία Υπόθεσης'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
