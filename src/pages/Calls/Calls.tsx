import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOutgoing, Plus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCalls, linkCallToCase, searchCasesForCall } from './callUtils';
import type { Call } from './types';
import NewCallModal from './modals/NewCallModal';

export default function Calls() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Inline link-to-case state
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkOptions, setLinkOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchCalls(tenantId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  useEffect(() => {
    if (!linkingId || !linkQuery.trim() || !tenantId) { setLinkOptions([]); return; }
    const t = setTimeout(async () => {
      setLinkSearching(true);
      const results = await searchCasesForCall(tenantId, linkQuery.trim());
      setLinkOptions(results);
      setLinkSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [linkQuery, linkingId, tenantId]);

  const handleLink = async (callId: string, caseId: string) => {
    setLinking(true);
    try {
      await linkCallToCase(callId, caseId);
      setLinkingId(null);
      setLinkQuery('');
      setLinkOptions([]);
      load();
    } finally {
      setLinking(false);
    }
  };

  const unlinked = calls.filter((c) => !c.case_id);
  const linked = calls.filter((c) => c.case_id);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Κλήσεις</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Νέα Κλήση
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Phone className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Δεν υπάρχουν κλήσεις ακόμα.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unlinked.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-orange-400">Εκκρεμείς — χωρίς υπόθεση ({unlinked.length})</h2>
              </div>
              <div className="space-y-2">
                {unlinked.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    unlinked
                    linkingId={linkingId}
                    linkQuery={linkQuery}
                    linkOptions={linkOptions}
                    linkSearching={linkSearching}
                    linking={linking}
                    onStartLink={() => { setLinkingId(call.id); setLinkQuery(''); setLinkOptions([]); }}
                    onCancelLink={() => { setLinkingId(null); setLinkQuery(''); setLinkOptions([]); }}
                    onLinkQueryChange={setLinkQuery}
                    onSelectCase={(caseId) => handleLink(call.id, caseId)}
                    onNavigateCase={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          {linked.length > 0 && (
            <div>
              {unlinked.length > 0 && <h2 className="text-sm font-semibold text-text-primary mb-3">Συνδεδεμένες ({linked.length})</h2>}
              <div className="space-y-2">
                {linked.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    unlinked={false}
                    linkingId={null}
                    linkQuery=""
                    linkOptions={[]}
                    linkSearching={false}
                    linking={false}
                    onStartLink={() => {}}
                    onCancelLink={() => {}}
                    onLinkQueryChange={() => {}}
                    onSelectCase={() => {}}
                    onNavigateCase={() => navigate(`/cases/${call.case_id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <NewCallModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => load()}
      />
    </div>
  );
}

type CallRowProps = {
  call: Call;
  unlinked: boolean;
  linkingId: string | null;
  linkQuery: string;
  linkOptions: { id: string; code: string; title: string }[];
  linkSearching: boolean;
  linking: boolean;
  onStartLink: () => void;
  onCancelLink: () => void;
  onLinkQueryChange: (q: string) => void;
  onSelectCase: (caseId: string) => void;
  onNavigateCase: () => void;
};

function CallRow({
  call, unlinked, linkingId, linkQuery, linkOptions, linkSearching, linking,
  onStartLink, onCancelLink, onLinkQueryChange, onSelectCase, onNavigateCase,
}: CallRowProps) {
  const isLinking = linkingId === call.id;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${unlinked ? 'border-orange-500/20 bg-orange-500/5' : 'border-border/10 bg-secondary-background'}`}>
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
            {call.caller_name && <span className="text-sm font-medium text-text-primary">{call.caller_name}</span>}
            {call.phone && <span className="text-sm text-text-secondary">{call.phone}</span>}
            {call.follow_up_required && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400">
                Follow-up
              </span>
            )}
            <span className="text-xs text-text-secondary ml-auto shrink-0">
              {new Date(call.created_at).toLocaleDateString('el-GR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          {call.description && <p className="text-sm text-text-secondary mt-1 line-clamp-2">{call.description}</p>}
          {call.case_code && (
            <button
              onClick={onNavigateCase}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
            >
              <span className="font-mono">{call.case_code}</span>
              <span className="text-text-secondary">— {call.case_title}</span>
            </button>
          )}
        </div>
      </div>

      {unlinked && !isLinking && (
        <button
          onClick={onStartLink}
          className="text-xs font-medium text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
        >
          + Σύνδεση με υπόθεση
        </button>
      )}

      {isLinking && (
        <div className="space-y-2 pt-1">
          <input
            className="input w-full text-sm"
            placeholder="Αναζήτηση υπόθεσης…"
            value={linkQuery}
            onChange={(e) => onLinkQueryChange(e.target.value)}
            autoFocus
          />
          {linkSearching && <p className="text-xs text-text-secondary">Αναζήτηση…</p>}
          {linkOptions.length > 0 && (
            <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10">
              {linkOptions.map((c) => (
                <button
                  key={c.id}
                  disabled={linking}
                  onClick={() => onSelectCase(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors text-left"
                >
                  <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
                  <span className="text-sm text-text-primary truncate">{c.title}</span>
                </button>
              ))}
            </div>
          )}
          {linkQuery.trim() && !linkSearching && linkOptions.length === 0 && (
            <p className="text-xs text-text-secondary">Δεν βρέθηκαν υποθέσεις.</p>
          )}
          <button onClick={onCancelLink} className="text-xs text-text-secondary hover:text-text-primary cursor-pointer">
            Ακύρωση
          </button>
        </div>
      )}
    </div>
  );
}
