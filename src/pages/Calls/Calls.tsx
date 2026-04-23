import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOutgoing, Plus, AlertCircle, Link2 } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCalls, linkCallToCase, searchCasesForCall } from './callUtils';
import type { Call } from './types';
import NewCallModal from './modals/NewCallModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';

// Inline case-linking cell — rendered inside the Case column
function CaseLinkCell({
  call,
  tenantId,
  onLinked,
}: {
  call: Call;
  tenantId: string;
  onLinked: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'idle' | 'searching'>('idle');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!query.trim() || !tenantId) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const results = await searchCasesForCall(tenantId, query.trim());
      setOptions(results);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const handleLink = async (caseId: string) => {
    setLinking(true);
    try {
      await linkCallToCase(call.id, caseId);
      onLinked();
    } finally {
      setLinking(false);
    }
  };

  if (call.case_id) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/cases/${call.case_id}`); }}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
      >
        <span className="font-mono">{call.case_code}</span>
        {call.case_title && <span className="text-text-secondary truncate max-w-32">— {call.case_title}</span>}
      </button>
    );
  }

  if (mode === 'idle') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setMode('searching'); }}
        className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
      >
        <Link2 className="h-3 w-3" />
        Σύνδεση
      </button>
    );
  }

  return (
    <div className="space-y-1 min-w-48" onClick={(e) => e.stopPropagation()}>
      <input
        className="input w-full text-xs py-1"
        placeholder="Αναζήτηση υπόθεσης…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {searching && <p className="text-xs text-text-secondary px-1">Αναζήτηση…</p>}
      {options.length > 0 && (
        <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10 bg-secondary-background shadow-lg z-10 relative">
          {options.map((c) => (
            <button
              key={c.id}
              disabled={linking}
              onClick={() => handleLink(c.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer transition-colors text-left"
            >
              <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
              <span className="text-xs text-text-primary truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && !searching && options.length === 0 && (
        <p className="text-xs text-text-secondary px-1">Δεν βρέθηκαν.</p>
      )}
      <button
        onClick={() => { setMode('idle'); setQuery(''); setOptions([]); }}
        className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
      >
        Ακύρωση
      </button>
    </div>
  );
}

export default function Calls() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchCalls(tenantId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const columns: ColumnDef<Call>[] = [
    {
      key: 'direction',
      header: 'Τύπος',
      render: (c) => (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          c.direction === 'incoming' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
        }`}>
          {c.direction === 'incoming'
            ? <PhoneIncoming className="h-3.5 w-3.5" />
            : <PhoneOutgoing className="h-3.5 w-3.5" />}
        </div>
      ),
      sortValue: (c) => c.direction,
    },
    {
      key: 'caller_name',
      header: 'Καλών',
      render: (c) => <span className="font-medium text-text-primary">{c.caller_name ?? '—'}</span>,
      sortValue: (c) => c.caller_name ?? '',
    },
    {
      key: 'phone',
      header: 'Τηλέφωνο',
      render: (c) => <span className="text-text-secondary">{c.phone ?? '—'}</span>,
      sortValue: (c) => c.phone ?? '',
    },
    {
      key: 'follow_up',
      header: 'Follow-up',
      render: (c) => c.follow_up_required
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400">Follow-up</span>
        : <span className="text-text-secondary">—</span>,
      sortValue: (c) => (c.follow_up_required ? 'yes' : 'no'),
    },
    {
      key: 'case',
      header: 'Υπόθεση',
      render: (c) => (
        <CaseLinkCell call={c} tenantId={tenantId} onLinked={load} />
      ),
      sortValue: (c) => c.case_code ?? '',
    },
    {
      key: 'description',
      header: 'Περιγραφή',
      render: (c) => <span className="text-text-secondary text-xs line-clamp-2 max-w-56">{c.description ?? '—'}</span>,
      sortValue: (c) => c.description ?? '',
      defaultVisible: false,
    },
    {
      key: 'created_at',
      header: 'Ημ/νία',
      render: (c) => (
        <span className="text-xs text-text-secondary whitespace-nowrap">
          {new Date(c.created_at).toLocaleDateString('el-GR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
      sortValue: (c) => c.created_at,
    },
  ];

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
      ) : (
        <DataTable
          tableId="calls"
          columns={columns}
          data={calls}
          rowKey={(c) => c.id}
          onRowClick={(c) => { if (c.case_id) navigate(`/cases/${c.case_id}`); }}
          rowClassName={(c) => !c.case_id ? 'bg-orange-500/5' : ''}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
              <Phone className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Δεν υπάρχουν κλήσεις ακόμα.</p>
            </div>
          }
        />
      )}

      {!loading && calls.some((c) => !c.case_id) && (
        <div className="flex items-center gap-2 text-xs text-orange-400">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{calls.filter((c) => !c.case_id).length} κλήσεις χωρίς σύνδεση με υπόθεση</span>
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
