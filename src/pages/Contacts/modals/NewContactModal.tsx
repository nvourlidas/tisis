import { useState } from 'react';
import { X } from 'lucide-react';
import type { ContactFormData } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
  initialPhone?: string;
};

const empty: ContactFormData = { name: '', phone: '', email: '', role: '', notes: '' };

export default function NewContactModal({ open, onClose, onSubmit, initialPhone }: Props) {
  const [form, setForm] = useState<ContactFormData>(() => ({ ...empty, phone: initialPhone ?? '' }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const set = (k: keyof ContactFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
      setError(err?.message ?? 'Αποτυχία δημιουργίας επαφής.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-secondary-background rounded-2xl border border-border/10 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
          <h2 className="text-base font-semibold text-text-primary">Νέα Επαφή</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Όνομα <span className="text-danger">*</span></label>
            <input className="input w-full" value={form.name} onChange={set('name')} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Τηλέφωνο</label>
              <input className="input w-full" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email</label>
              <input className="input w-full" type="email" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Ρόλος</label>
            <input className="input w-full" value={form.role} onChange={set('role')} placeholder="π.χ. Μάρτυρας, Αντίδικος, Συνεργάτης" />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Σημειώσεις</label>
            <textarea className="input w-full resize-none" rows={3} value={form.notes} onChange={set('notes')} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary cursor-pointer">Ακύρωση</button>
            <button type="submit" disabled={loading} className="btn-primary cursor-pointer">
              {loading ? 'Αποθήκευση…' : 'Δημιουργία Επαφής'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
