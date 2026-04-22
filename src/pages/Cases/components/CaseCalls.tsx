import { useEffect, useState } from 'react';
import { Plus, PhoneIncoming, PhoneOutgoing, X } from 'lucide-react';
import { fetchCaseCalls } from '../caseUtils';
import { createCall } from '../../Calls/callUtils';
import type { CaseCall } from '../types';

type Props = { caseId: string; tenantId: string };

const emptyForm = {
  phone: '', caller_name: '', direction: 'incoming' as 'incoming' | 'outgoing',
  description: '', follow_up_required: false,
};

export default function CaseCalls({ caseId, tenantId }: Props) {
  const [calls, setCalls] = useState<CaseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseCalls(caseId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCall(tenantId, {
        ...form,
        case_id: caseId,
        contact_id: '',
        create_task: false,
        task_title: '',
        task_due_date: '',
      });
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία καταχώρησης κλήσης.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{calls.length} κλήσεις</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Νέα Κλήση
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Καταχώρηση Κλήσης</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Τηλέφωνο</label>
              <input
                className="input w-full"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="π.χ. 6912345678"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Όνομα Καλούντος</label>
              <input
                className="input w-full"
                value={form.caller_name}
                onChange={(e) => setForm((f) => ({ ...f, caller_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Κατεύθυνση</label>
              <div className="flex gap-2">
                {(['incoming', 'outgoing'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: d }))}
                    className={[
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-all cursor-pointer',
                      form.direction === d
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                    ].join(' ')}
                  >
                    {d === 'incoming'
                      ? <><PhoneIncoming className="h-3.5 w-3.5" />Εισερχόμενη</>
                      : <><PhoneOutgoing className="h-3.5 w-3.5" />Εξερχόμενη</>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="follow_up"
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.follow_up_required}
                onChange={(e) => setForm((f) => ({ ...f, follow_up_required: e.target.checked }))}
              />
              <label htmlFor="follow_up" className="text-sm text-text-secondary cursor-pointer">
                Απαιτείται Follow-up
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary cursor-pointer">
              Ακύρωση
            </button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Καταχώρηση'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν κλήσεις για αυτή την υπόθεση.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div key={call.id} className="rounded-xl border border-border/10 bg-secondary-background p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  call.direction === 'incoming' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {call.direction === 'incoming'
                    ? <PhoneIncoming className="h-3.5 w-3.5" />
                    : <PhoneOutgoing className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {call.caller_name && (
                      <span className="text-sm font-medium text-text-primary">{call.caller_name}</span>
                    )}
                    {call.phone && (
                      <span className="text-sm text-text-secondary">{call.phone}</span>
                    )}
                    {call.follow_up_required && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400">
                        Follow-up
                      </span>
                    )}
                    <span className="text-xs text-text-secondary ml-auto">
                      {new Date(call.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {call.description && (
                    <p className="text-sm text-text-secondary mt-1">{call.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
