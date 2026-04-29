import { useState } from 'react';
import { X } from 'lucide-react';
import type { ContactFormData } from '../types';
import RoleSelect from '../../../components/RoleSelect';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
  initialPhone?: string;
  tenantId?: string;
};

const empty: ContactFormData = {
  name: '', phone: '', phone2: '', email: '', role: '', notes: '',
  vat: '', address: '', professional_status: '',
  father_name: '', mother_name: '', birthdate: '',
  amka: '', iban: '', at: '', taxis_username: '', taxis_password: '',
};

export default function NewContactModal({ open, onClose, onSubmit, initialPhone, tenantId = '' }: Props) {
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
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
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
              <label className="block text-sm text-text-secondary mb-1">Τηλέφωνο 2</label>
              <input className="input w-full" value={form.phone2} onChange={set('phone2')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Email</label>
              <input className="input w-full" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ρόλος</label>
              <RoleSelect tenantId={tenantId} value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">ΑΦΜ</label>
              <input className="input w-full" value={form.vat} onChange={set('vat')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Επαγγελματική Ιδιότητα</label>
              <input className="input w-full" value={form.professional_status} onChange={set('professional_status')} placeholder="π.χ. Ιδιώτης" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Διεύθυνση</label>
            <input className="input w-full" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Όνομα πατρός</label>
              <input className="input w-full" value={form.father_name} onChange={set('father_name')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Όνομα μητρός</label>
              <input className="input w-full" value={form.mother_name} onChange={set('mother_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ημ/νία γέννησης</label>
              <input className="input w-full" type="date" value={form.birthdate} onChange={set('birthdate')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">ΑΜΚΑ</label>
              <input className="input w-full" value={form.amka} onChange={set('amka')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">IBAN</label>
              <input className="input w-full" value={form.iban} onChange={set('iban')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">ΑΤ (Αστυνομική Ταυτότητα)</label>
              <input className="input w-full" value={form.at} onChange={set('at')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Taxisnet Username</label>
              <input className="input w-full" value={form.taxis_username} onChange={set('taxis_username')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Taxisnet Password</label>
              <input className="input w-full" type="password" value={form.taxis_password} onChange={set('taxis_password')} />
            </div>
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
