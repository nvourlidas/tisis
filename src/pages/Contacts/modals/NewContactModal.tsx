import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { ContactFormData } from '../types';
import { mergeNotesWithAutoBlock } from '../contactUtils';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
  initialPhone?: string;
  tenantId?: string;
  zIndex?: string;
};

const empty: ContactFormData = {
  name: '', phone: '', phone2: '', phone3: '', phone4: '',
  email: '', email2: '', email3: '', email4: '', notes: '',
  vat: '', address: '', job_title: '', organization: '', website: '',
  father_name: '', mother_name: '', birthdate: '',
  amka: '', iban: '', at: '', taxis_username: '', taxis_password: '',
};

const PHONE_KEYS = ['phone', 'phone2', 'phone3', 'phone4'] as const;
const EMAIL_KEYS = ['email', 'email2', 'email3', 'email4'] as const;

export default function NewContactModal({ open, onClose, onSubmit, initialPhone, zIndex = 'z-50' }: Props) {
  const [form, setForm] = useState<ContactFormData>(() => ({ ...empty, phone: initialPhone ?? '' }));
  const [phoneSlots, setPhoneSlots] = useState(1);
  const [emailSlots, setEmailSlots] = useState(1);
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
      const { vat, father_name, mother_name, amka, iban, at, taxis_username, taxis_password } = form;
      const notes = mergeNotesWithAutoBlock(form.notes, { vat, father_name, mother_name, amka, iban, at, taxis_username, taxis_password });
      await onSubmit({ ...form, notes });
      setForm(empty);
      setPhoneSlots(1);
      setEmailSlots(1);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας επαφής.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm`}>
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
          <div className="space-y-2">
            {PHONE_KEYS.slice(0, phoneSlots).map((key, i) => (
              <div key={key}>
                <label className="block text-sm text-text-secondary mb-1">{i === 0 ? 'Τηλέφωνο' : `Τηλέφωνο ${i + 1}`}</label>
                <input className="input w-full" value={form[key]} onChange={set(key)} />
              </div>
            ))}
            {phoneSlots < 4 && (
              <button type="button" onClick={() => setPhoneSlots(s => s + 1)} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> Προσθήκη τηλεφώνου
              </button>
            )}
          </div>
          <div className="space-y-2">
            {EMAIL_KEYS.slice(0, emailSlots).map((key, i) => (
              <div key={key}>
                <label className="block text-sm text-text-secondary mb-1">{i === 0 ? 'Email' : `Email ${i + 1}`}</label>
                <input className="input w-full" type="email" value={form[key]} onChange={set(key)} />
              </div>
            ))}
            {emailSlots < 4 && (
              <button type="button" onClick={() => setEmailSlots(s => s + 1)} className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> Προσθήκη email
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">ΑΦΜ</label>
              <input className="input w-full" value={form.vat} onChange={set('vat')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Επαγγελματική Ιδιότητα</label>
              <input className="input w-full" value={form.job_title} onChange={set('job_title')} placeholder="π.χ. Δικηγόρος" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Διεύθυνση</label>
            <input className="input w-full" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Οργανισμός / Εταιρεία</label>
              <input className="input w-full" value={form.organization} onChange={set('organization')} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ιστοσελίδα</label>
              <input className="input w-full" type="url" value={form.website} onChange={set('website')} placeholder="https://" />
            </div>
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
