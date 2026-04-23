import { useEffect, useRef, useState } from 'react';
import { X, PhoneIncoming, PhoneOutgoing, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../auth';
import { createCall, lookupContactByPhone, searchCasesForCall } from '../callUtils';
import type { CallFormData } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (callId: string) => void;
  initialPhone?: string;
};

const empty: CallFormData = {
  phone: '',
  caller_name: '',
  direction: 'incoming',
  case_id: '',
  contact_id: '',
  description: '',
  follow_up_required: false,
  create_task: false,
  task_title: '',
  task_due_date: '',
};

export default function NewCallModal({ open, onClose, onCreated, initialPhone }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [form, setForm] = useState<CallFormData>(() => ({ ...empty, phone: initialPhone ?? '' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contact auto-suggest
  const [contactSuggestion, setContactSuggestion] = useState<{ id: string; name: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Case search
  const [showCaseSearch, setShowCaseSearch] = useState(false);
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [selectedCase, setSelectedCase] = useState<{ id: string; code: string; title: string } | null>(null);
  const [searchingCases, setSearchingCases] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setForm({ ...empty, phone: initialPhone ?? '' });
      setContactSuggestion(null);
      setSelectedCase(null);
      setCaseQuery('');
      setCaseOptions([]);
      setShowCaseSearch(false);
      setError(null);
      setTimeout(() => phoneRef.current?.focus(), 50);
    }
  }, [open, initialPhone]);

  // Phone → contact lookup
  useEffect(() => {
    if (!form.phone || form.phone.length < 4 || !tenantId) {
      setContactSuggestion(null);
      return;
    }
    const t = setTimeout(async () => {
      setLookingUp(true);
      const found = await lookupContactByPhone(tenantId, form.phone);
      setContactSuggestion(found);
      setLookingUp(false);
    }, 300);
    return () => clearTimeout(t);
  }, [form.phone, tenantId]);

  // Case search
  useEffect(() => {
    if (!showCaseSearch || !caseQuery.trim() || !tenantId) {
      setCaseOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingCases(true);
      const results = await searchCasesForCall(tenantId, caseQuery.trim());
      setCaseOptions(results);
      setSearchingCases(false);
    }, 250);
    return () => clearTimeout(t);
  }, [caseQuery, showCaseSearch, tenantId]);

  const applyContactSuggestion = () => {
    if (!contactSuggestion) return;
    setForm((f) => ({ ...f, caller_name: contactSuggestion.name, contact_id: contactSuggestion.id }));
    setContactSuggestion(null);
  };

  const selectCase = (c: { id: string; code: string; title: string }) => {
    setSelectedCase(c);
    setForm((f) => ({ ...f, case_id: c.id }));
    setShowCaseSearch(false);
    setCaseQuery('');
    setCaseOptions([]);
  };

  const clearCase = () => {
    setSelectedCase(null);
    setForm((f) => ({ ...f, case_id: '' }));
  };

  const set = <K extends keyof CallFormData>(k: K, v: CallFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const callId = await createCall(tenantId, form);
      onCreated?.(callId);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία καταχώρησης κλήσης.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <h2 className="text-base font-semibold text-text-primary">Νέα Κλήση</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Direction toggle */}
          <div className="flex gap-2">
            {(['incoming', 'outgoing'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('direction', d)}
                className={[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer',
                  form.direction === d
                    ? d === 'incoming'
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                ].join(' ')}
              >
                {d === 'incoming'
                  ? <><PhoneIncoming className="h-4 w-4" />Εισερχόμενη</>
                  : <><PhoneOutgoing className="h-4 w-4" />Εξερχόμενη</>}
              </button>
            ))}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Τηλέφωνο</label>
            <input
              ref={phoneRef}
              className="input w-full"
              placeholder="π.χ. 6912345678"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            {lookingUp && <p className="text-xs text-text-secondary mt-1">Αναζήτηση επαφής…</p>}
            {contactSuggestion && !lookingUp && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-xs text-primary flex-1">
                  Βρέθηκε: <strong>{contactSuggestion.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={applyContactSuggestion}
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  Εφαρμογή
                </button>
              </div>
            )}
          </div>

          {/* Caller name */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Όνομα</label>
            <input
              className="input w-full"
              placeholder="Ονοματεπώνυμο καλούντος"
              value={form.caller_name}
              onChange={(e) => set('caller_name', e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Περιγραφή</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Σύντομη περιγραφή της κλήσης…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Link to case */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Υπόθεση</label>
            {selectedCase ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/10 bg-white/3 px-4 py-2.5">
                <span className="font-mono text-xs text-text-secondary">{selectedCase.code}</span>
                <span className="text-sm text-text-primary flex-1 truncate">{selectedCase.title}</span>
                <button type="button" onClick={clearCase} className="text-text-secondary hover:text-danger cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                {!showCaseSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowCaseSearch(true)}
                    className="w-full flex items-center gap-2 rounded-xl border border-dashed border-border/20 bg-white/2 px-4 py-2.5 text-sm text-text-secondary hover:border-border/40 hover:bg-white/4 transition-all cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    Σύνδεση με υπόθεση (προαιρετικό)
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                      <input
                        className="input w-full pl-9!"
                        placeholder="Αναζήτηση κωδικού ή τίτλου…"
                        value={caseQuery}
                        onChange={(e) => setCaseQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {searchingCases && <p className="text-xs text-text-secondary">Αναζήτηση…</p>}
                    {caseOptions.length > 0 && (
                      <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
                        {caseOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCase(c)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors text-left"
                          >
                            <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
                            <span className="text-sm text-text-primary truncate">{c.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {caseQuery.trim() && !searchingCases && caseOptions.length === 0 && (
                      <p className="text-xs text-text-secondary">Δεν βρέθηκαν υποθέσεις.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowCaseSearch(false); setCaseQuery(''); }}
                      className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      Ακύρωση
                    </button>
                  </div>
                )}
              </div>
            )}
            {!selectedCase && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-orange-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Χωρίς σύνδεση υπόθεσης η κλήση θα σημανθεί ως εκκρεμής
              </p>
            )}
          </div>

          {/* Follow-up + Create task */}
          <div className="space-y-3 rounded-xl border border-border/10 bg-white/2 px-4 py-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.follow_up_required}
                onChange={(e) => set('follow_up_required', e.target.checked)}
              />
              <span className="text-sm text-text-secondary">Απαιτείται follow-up</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.create_task}
                onChange={(e) => set('create_task', e.target.checked)}
              />
              <span className="text-sm text-text-secondary">Δημιουργία εργασίας από αυτή την κλήση</span>
            </label>
            {form.create_task && (
              <div className="space-y-2 pt-1 pl-6">
                <input
                  className="input w-full"
                  placeholder="Τίτλος εργασίας *"
                  value={form.task_title}
                  onChange={(e) => set('task_title', e.target.value)}
                  required={form.create_task}
                  autoFocus
                />
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Προθεσμία</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.task_due_date}
                    onChange={(e) => set('task_due_date', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary cursor-pointer">Ακύρωση</button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Καταχώρηση Κλήσης'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
