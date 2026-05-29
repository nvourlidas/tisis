import { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, Wand2, Loader2 } from 'lucide-react';
import { fetchClients } from '../../Clients/clientUtils';
import { fetchStages, nextCaseCode } from '../caseUtils';
import type { Client } from '../../Clients/types';
import type { CaseFormData, CaseStage } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CaseFormData) => Promise<void>;
  tenantId: string;
  defaultClientId?: string;
};

const CASE_TYPES = ['Αστικό', 'Ποινικό', 'Διοικητικό', 'Εμπορικό'] as const;

const today = () => new Date().toISOString().slice(0, 10);

const empty = (): CaseFormData => ({
  code: '', title: '', client_id: '', status: 'active', type: '',
  stage_id: '', description: '', google_drive_url: '', notes: '',
  created_at: today(),
});

export default function NewCaseModal({ open, onClose, onSubmit, tenantId, defaultClientId }: Props) {
  const [form, setForm] = useState<CaseFormData>({ ...empty(), client_id: defaultClientId ?? '' });
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm({ ...empty(), client_id: defaultClientId ?? '' });
      setClientSearch('');
      setClientDropdownOpen(false);
      if (tenantId) {
        if (!defaultClientId) fetchClients(tenantId).then(setClients);
        fetchStages(tenantId).then(setStages);
      }
    }
  }, [open, tenantId, defaultClientId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      setForm(empty());
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας υπόθεσης.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
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
              <div className="flex gap-1.5">
                <input
                  className="input flex-1 min-w-0"
                  value={form.code}
                  onChange={set('code')}
                  required
                  autoFocus
                  placeholder="π.χ. Α60α"
                />
                <button
                  type="button"
                  title="Αυτόματος κωδικός"
                  disabled={generatingCode}
                  onClick={async () => {
                    setGeneratingCode(true);
                    try {
                      const code = await nextCaseCode(tenantId);
                      setForm((f) => ({ ...f, code }));
                    } finally {
                      setGeneratingCode(false);
                    }
                  }}
                  className="px-2.5 flex items-center justify-center rounded-lg border border-border/20 bg-surface-hover hover:bg-border/10 text-text-secondary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {generatingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </button>
              </div>
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
            <label className="block text-sm text-text-secondary mb-1">Ημερομηνία Δημιουργίας</label>
            <input
              type="date"
              className="input w-full"
              value={form.created_at}
              onChange={set('created_at')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Τύπος Υπόθεσης</label>
              <select className="input w-full" value={form.type} onChange={set('type')}>
                <option value="">— Επιλέξτε τύπο —</option>
                {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Στάδιο</label>
              <select className="input w-full" value={form.stage_id} onChange={set('stage_id')}>
                <option value="">— Χωρίς στάδιο —</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <div ref={clientDropdownRef}>
              <label className="block text-sm text-text-secondary mb-1">Εντολέας</label>
              <button
                type="button"
                onClick={() => setClientDropdownOpen((o) => !o)}
                className="input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className={form.client_id ? 'text-text-primary' : 'text-text-secondary'}>
                  {form.client_id ? (clients.find((c) => c.id === form.client_id)?.name ?? '—') : '— Χωρίς εντολέα —'}
                </span>
                <ChevronDown className={`h-4 w-4 text-text-secondary shrink-0 transition-transform ${clientDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {clientDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full max-w-116 rounded-xl border border-border/15 bg-secondary-background shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-border/10">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-background border border-border/10">
                      <Search className="h-3.5 w-3.5 text-text-secondary shrink-0" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none text-text-primary placeholder:text-text-secondary"
                        placeholder="Αναζήτηση εντολέα…"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, client_id: '' })); setClientDropdownOpen(false); setClientSearch(''); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-text-secondary hover:bg-border/5 transition-colors"
                    >
                      — Χωρίς εντολέα —
                    </button>
                    {clients
                      .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setForm((f) => ({ ...f, client_id: c.id })); setClientDropdownOpen(false); setClientSearch(''); }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-border/5 ${form.client_id === c.id ? 'text-primary font-medium bg-primary/5' : 'text-text-primary'}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    {clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <p className="px-4 py-3 text-sm text-text-secondary">Δεν βρέθηκαν εντολείς.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
