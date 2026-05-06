import { useEffect, useState } from 'react';
import { Plus, PhoneIncoming, PhoneOutgoing, X, Link, Phone, RotateCcw } from 'lucide-react';
import { fetchCaseCalls } from '../caseUtils';
import { createCall, fetchUnlinkedCalls, linkCallToCase } from '../../Calls/callUtils';
import type { CaseCall } from '../types';
import type { Call } from '../../Calls/types';

type Props = { caseId: string; tenantId: string };

const emptyForm = {
  phone: '', caller_name: '', direction: 'incoming' as 'incoming' | 'outgoing',
  description: '', follow_up_required: false,
};

type Mode = 'none' | 'new' | 'link';

export default function CaseCalls({ caseId, tenantId }: Props) {
  const [calls, setCalls] = useState<CaseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('none');

  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unlinked, setUnlinked] = useState<Call[]>([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseCalls(caseId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const openMode = (m: Mode) => {
    setMode(prev => prev === m ? 'none' : m);
    setError(null);
    if (m === 'link') {
      setUnlinkedLoading(true);
      fetchUnlinkedCalls(tenantId).then(setUnlinked).finally(() => setUnlinkedLoading(false));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCall(tenantId, { ...form, case_id: caseId, contact_id: '', create_task: false, task_title: '', task_due_date: '' });
      setForm({ ...emptyForm });
      setMode('none');
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία καταχώρησης κλήσης.');
    } finally {
      setSaving(false);
    }
  };

  const doLink = async (callId: string) => {
    setLinking(callId);
    try {
      await linkCallToCase(callId, caseId);
      setMode('none');
      load();
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">{calls.length} κλήσεις</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openMode('link')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-all cursor-pointer ${
              mode === 'link'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/15 text-text-secondary hover:text-text-primary hover:bg-border/5'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            Σύνδεση υπάρχουσας
          </button>
          <button
            onClick={() => openMode('new')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-all cursor-pointer ${
              mode === 'new'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/15 text-text-secondary hover:text-text-primary hover:bg-border/5'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Νέα Κλήση
          </button>
        </div>
      </div>

      {/* New call form */}
      {mode === 'new' && (
        <form onSubmit={handleSubmit} className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Καταχώρηση Κλήσης</h3>
            <button type="button" onClick={() => setMode('none')} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Τηλέφωνο</label>
              <input className="input w-full rounded-xl border-border/15" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="π.χ. 6912345678" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Όνομα Καλούντος</label>
              <input className="input w-full rounded-xl border-border/15" value={form.caller_name} onChange={(e) => setForm(f => ({ ...f, caller_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Κατεύθυνση</label>
              <div className="flex gap-2">
                {(['incoming', 'outgoing'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, direction: d }))}
                    className={[
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm transition-all cursor-pointer font-medium',
                      form.direction === d
                        ? d === 'incoming'
                          ? 'border-green-500/30 bg-green-500/10 text-green-500'
                          : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                        : 'border-border/15 text-text-secondary hover:bg-border/5',
                    ].join(' ')}
                  >
                    {d === 'incoming'
                      ? <><PhoneIncoming className="h-3.5 w-3.5" />Εισερχόμενη</>
                      : <><PhoneOutgoing className="h-3.5 w-3.5" />Εξερχόμενη</>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2.5 pt-5">
              <input
                id="follow_up"
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.follow_up_required}
                onChange={(e) => setForm(f => ({ ...f, follow_up_required: e.target.checked }))}
              />
              <label htmlFor="follow_up" className="text-sm text-text-secondary cursor-pointer select-none">
                Απαιτείται Follow-up
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Περιγραφή</label>
              <textarea className="input w-full rounded-xl border-border/15 resize-none" rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode('none')} className="px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:bg-border/5 cursor-pointer transition-all">Ακύρωση</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 cursor-pointer transition-all disabled:opacity-60">
              {saving ? 'Αποθήκευση…' : 'Καταχώρηση'}
            </button>
          </div>
        </form>
      )}

      {/* Link existing */}
      {mode === 'link' && (
        <div className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Σύνδεση υπάρχουσας κλήσης</h3>
            <button onClick={() => setMode('none')} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          {unlinkedLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <RotateCcw className="h-3.5 w-3.5 animate-spin" /> Φόρτωση…
            </div>
          ) : unlinked.length === 0 ? (
            <p className="text-sm text-text-secondary py-2">Δεν υπάρχουν εκκρεμείς κλήσεις χωρίς υπόθεση.</p>
          ) : (
            <div className="space-y-2">
              {unlinked.map((call) => (
                <div key={call.id} className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                  <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${call.direction === 'incoming' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {call.direction === 'incoming' ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {call.caller_name && <span className="text-sm font-medium text-text-primary">{call.caller_name}</span>}
                      {call.phone && <span className="text-sm text-text-secondary font-mono">{call.phone}</span>}
                      <span className="text-xs text-text-secondary ml-auto">
                        {new Date(call.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {call.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{call.description}</p>}
                  </div>
                  <button
                    disabled={linking === call.id}
                    onClick={() => doLink(call.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:bg-primary/10 px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {linking === call.id ? <RotateCcw className="h-3 w-3 animate-spin" /> : null}
                    {linking === call.id ? 'Σύνδεση…' : 'Σύνδεση'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Call list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse-soft py-4">
          <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση κλήσεων…
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
          <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
            <Phone className="h-6 w-6 opacity-30" />
          </div>
          <p className="text-sm">Δεν υπάρχουν κλήσεις για αυτή την υπόθεση.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div key={call.id} className="rounded-xl border border-border/10 bg-secondary-background p-4 hover:border-border/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${call.direction === 'incoming' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {call.direction === 'incoming' ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {call.caller_name && <span className="text-sm font-semibold text-text-primary">{call.caller_name}</span>}
                    {call.phone && <span className="text-sm text-text-secondary font-mono">{call.phone}</span>}
                    {call.follow_up_required && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-500">
                        Follow-up
                      </span>
                    )}
                    <span className="text-xs text-text-secondary ml-auto">
                      {new Date(call.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {call.description && <p className="text-sm text-text-secondary mt-1 leading-relaxed">{call.description}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
