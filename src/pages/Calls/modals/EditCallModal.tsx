import { useEffect, useState } from 'react';
import { X, Phone, Users, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../auth';
import { updateCall, searchCasesForCall } from '../callUtils';
import type { Call } from '../types';

type Props = {
  open: boolean;
  call: Call | null;
  onClose: () => void;
  onUpdated: () => void;
};

export default function EditCallModal({ open, call, onClose, onUpdated }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [direction, setDirection] = useState<'phone' | 'inperson'>('phone');
  const [createdAt, setCreatedAt] = useState('');
  const [phone, setPhone] = useState('');
  const [callerName, setCallerName] = useState('');
  const [description, setDescription] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseDisplay, setCaseDisplay] = useState<{ code: string; title: string } | null>(null);

  const [showCaseSearch, setShowCaseSearch] = useState(false);
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [searchingCases, setSearchingCases] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && call) {
      setDirection(call.direction);
      // Format for datetime-local input
      const d = new Date(call.created_at);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setCreatedAt(d.toISOString().slice(0, 16));
      setPhone(call.phone ?? '');
      setCallerName(call.caller_name ?? '');
      setDescription(call.description ?? '');
      setFollowUp(call.follow_up_required);
      setCaseId(call.case_id);
      setCaseDisplay(call.case_code ? { code: call.case_code, title: call.case_title ?? '' } : null);
      setShowCaseSearch(false);
      setCaseQuery('');
      setCaseOptions([]);
      setError(null);
    }
  }, [open, call]);

  useEffect(() => {
    if (!showCaseSearch || !caseQuery.trim() || !tenantId) { setCaseOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingCases(true);
      const results = await searchCasesForCall(tenantId, caseQuery.trim());
      setCaseOptions(results);
      setSearchingCases(false);
    }, 250);
    return () => clearTimeout(t);
  }, [caseQuery, showCaseSearch, tenantId]);

  const selectCase = (c: { id: string; code: string; title: string }) => {
    setCaseId(c.id);
    setCaseDisplay({ code: c.code, title: c.title });
    setShowCaseSearch(false);
    setCaseQuery('');
    setCaseOptions([]);
  };

  const clearCase = () => {
    setCaseId(null);
    setCaseDisplay(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!call) return;
    setSaving(true);
    setError(null);
    try {
      await updateCall(call.id, {
        direction,
        phone: phone || undefined,
        caller_name: callerName || undefined,
        description,
        follow_up_required: followUp,
        case_id: caseId,
        created_at: new Date(createdAt).toISOString(),
      });
      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !call) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <h2 className="text-base font-semibold text-text-primary">Επεξεργασία Γεγονότος</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Direction */}
          <div className="flex gap-2">
            {(['phone', 'inperson'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer',
                  direction === d
                    ? d === 'phone'
                      ? 'border-green-500/30 bg-green-500/10 text-green-400'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                ].join(' ')}
              >
                {d === 'phone' ? <><Phone className="h-4 w-4" />Τηλεφώνημα</> : <><Users className="h-4 w-4" />Δια ζώσης</>}
              </button>
            ))}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ημερομηνία</label>
              <input
                type="date"
                className="input w-full"
                value={createdAt.slice(0, 10)}
                onChange={(e) => setCreatedAt(e.target.value + 'T' + (createdAt.slice(11, 16) || '00:00'))}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ώρα</label>
              <input
                type="time"
                className="input w-full"
                value={createdAt.slice(11, 16)}
                onChange={(e) => setCreatedAt((createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10)) + 'T' + e.target.value)}
              />
            </div>
          </div>

          {/* Caller name */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Όνομα</label>
            <input
              className="input w-full"
              placeholder="Όνομα καλούντος"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Τηλέφωνο</label>
            <input
              className="input w-full"
              placeholder="π.χ. 6912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Περιγραφή <span className="text-danger">*</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Case */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Υπόθεση</label>
            {caseDisplay ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/10 bg-white/3 px-4 py-2.5">
                <span className="font-mono text-xs text-text-secondary shrink-0">{caseDisplay.code}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{caseDisplay.title}</div>
                </div>
                <button type="button" onClick={clearCase} className="text-text-secondary hover:text-danger cursor-pointer shrink-0">
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
                        placeholder="Αναζήτηση κωδικού, τίτλου ή εντολέα…"
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
                {!caseDisplay && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-orange-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Χωρίς σύνδεση υπόθεσης το γεγονός θα σημανθεί ως εκκρεμές
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Follow-up */}
          <div className="rounded-xl border border-border/10 bg-white/2 px-4 py-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={followUp}
                onChange={(e) => setFollowUp(e.target.checked)}
              />
              <span className="text-sm text-text-secondary">Απαιτείται follow-up</span>
            </label>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary cursor-pointer">Ακύρωση</button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
