import { useEffect, useState } from 'react';
import { Plus, Users, X, Link, Phone, RotateCcw, Pencil, Trash2 } from 'lucide-react';
import { fetchCaseCalls } from '../caseUtils';
import { fetchUnlinkedCalls, linkCallToCase, deleteCall } from '../../Calls/callUtils';
import NewCallModal from '../../Calls/modals/NewCallModal';
import EditCallModal from '../../Calls/modals/EditCallModal';
import type { CaseCall } from '../types';
import type { Call } from '../../Calls/types';

type Props = { caseId: string; tenantId: string };

type Mode = 'none' | 'new' | 'link';

export default function CaseCalls({ caseId, tenantId }: Props) {
  const [calls, setCalls] = useState<CaseCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('none');

  const [unlinked, setUnlinked] = useState<Call[]>([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [editCall, setEditCall] = useState<Call | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseCalls(caseId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const openMode = (m: Mode) => {
    setMode(prev => prev === m ? 'none' : m);
    if (m === 'link') {
      setUnlinkedLoading(true);
      fetchUnlinkedCalls(tenantId).then(setUnlinked).finally(() => setUnlinkedLoading(false));
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

  const doDelete = async (callId: string) => {
    if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return;
    setDeletingId(callId);
    try {
      await deleteCall(callId);
      load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">{calls.length} γεγονότα</span>
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
            Νέο Γεγονός
          </button>
        </div>
      </div>

      <NewCallModal
        open={mode === 'new'}
        onClose={() => setMode('none')}
        onCreated={() => { setMode('none'); load(); }}
        initialCaseId={caseId}
      />

      <EditCallModal
        open={editCall !== null}
        call={editCall}
        onClose={() => setEditCall(null)}
        onUpdated={() => { setEditCall(null); load(); }}
      />

      {/* Link existing */}
      {mode === 'link' && (
        <div className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Σύνδεση υπάρχοντος γεγονότος</h3>
            <button onClick={() => setMode('none')} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          {unlinkedLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <RotateCcw className="h-3.5 w-3.5 animate-spin" /> Φόρτωση…
            </div>
          ) : unlinked.length === 0 ? (
            <p className="text-sm text-text-secondary py-2">Δεν υπάρχουν εκκρεμή γεγονότα χωρίς υπόθεση.</p>
          ) : (
            <div className="space-y-2">
              {unlinked.map((call) => (
                <div key={call.id} className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                  <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${call.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {call.direction === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
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
          <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση γεγονότων…
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
          <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
            <Phone className="h-6 w-6 opacity-30" />
          </div>
          <p className="text-sm">Δεν υπάρχουν γεγονότα για αυτή την υπόθεση.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div key={call.id} className="rounded-xl border border-border/10 bg-secondary-background p-4 hover:border-border/20 transition-colors group">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${call.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                  {call.direction === 'phone' ? <Phone className="h-4 w-4" /> : <Users className="h-4 w-4" />}
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
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => setEditCall({ ...call, tenant_id: tenantId, case_id: caseId, client_id: null, contact_id: null, case_code: null, case_title: null })}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                    title="Επεξεργασία"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={deletingId === call.id}
                    onClick={() => doDelete(call.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer transition-colors disabled:opacity-50"
                    title="Διαγραφή"
                  >
                    {deletingId === call.id ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
