import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOutgoing, Plus, AlertCircle, Link2, RotateCcw, Search, CalendarDays, X } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCalls, linkCallToCase, searchCasesForCall } from './callUtils';
import type { Call } from './types';
import NewCallModal from './modals/NewCallModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';

// Quick date range presets
type DatePreset = 'today' | 'week' | 'month' | 'custom' | '';

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    const t = fmt(now);
    return { from: t, to: t };
  }
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    return { from: fmt(start), to: fmt(now) };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: fmt(now) };
  }
  return { from: '', to: '' };
}

// Inline case-linking cell
function CaseLinkCell({ call, tenantId, onLinked }: { call: Call; tenantId: string; onLinked: () => void }) {
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

  // Filters
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [linkedFilter, setLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchCalls(tenantId).then(setCalls).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const { from, to } = getPresetRange(preset);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const clearDateFilter = () => {
    setDatePreset('');
    setDateFrom('');
    setDateTo('');
  };

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      if (directionFilter !== 'all' && c.direction !== directionFilter) return false;
      if (linkedFilter === 'linked' && !c.case_id) return false;
      if (linkedFilter === 'unlinked' && c.case_id) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(c.caller_name ?? '').toLowerCase().includes(q) &&
          !(c.phone ?? '').includes(q) &&
          !(c.description ?? '').toLowerCase().includes(q) &&
          !(c.case_code ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (dateFrom) {
        const callDate = c.created_at.slice(0, 10);
        if (callDate < dateFrom) return false;
      }
      if (dateTo) {
        const callDate = c.created_at.slice(0, 10);
        if (callDate > dateTo) return false;
      }
      return true;
    });
  }, [calls, directionFilter, linkedFilter, search, dateFrom, dateTo]);

  const unlinkedCount = calls.filter((c) => !c.case_id).length;

  const columns: ColumnDef<Call>[] = [
    {
      key: 'direction',
      header: 'Τύπος',
      render: (c) => (
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          c.direction === 'incoming' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
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
      render: (c) => <span className="font-semibold text-text-primary">{c.caller_name ?? '—'}</span>,
      sortValue: (c) => c.caller_name ?? '',
    },
    {
      key: 'phone',
      header: 'Τηλέφωνο',
      render: (c) => <span className="text-text-secondary font-mono">{c.phone ?? '—'}</span>,
      sortValue: (c) => c.phone ?? '',
    },
    {
      key: 'follow_up',
      header: 'Follow-up',
      render: (c) => c.follow_up_required
        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400">Follow-up</span>
        : <span className="text-text-secondary">—</span>,
      sortValue: (c) => (c.follow_up_required ? 'yes' : 'no'),
    },
    {
      key: 'case',
      header: 'Υπόθεση',
      render: (c) => <CaseLinkCell call={c} tenantId={tenantId} onLinked={load} />,
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

  const PRESETS: { label: string; value: DatePreset }[] = [
    { label: 'Σήμερα', value: 'today' },
    { label: 'Εβδομάδα', value: 'week' },
    { label: 'Μήνας', value: 'month' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Κλήσεις</h1>
          <p className="text-sm text-text-secondary mt-0.5">{filteredCalls.length} κλήσεις</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Νέα Κλήση
        </button>
      </div>

      {/* Unlinked warning */}
      {!loading && unlinkedCount > 0 && (
        <div className="animate-fade-in flex items-center gap-2.5 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm text-orange-400 font-medium">
            {unlinkedCount} {unlinkedCount === 1 ? 'κλήση χωρίς' : 'κλήσεις χωρίς'} σύνδεση με υπόθεση
          </span>
          <button
            onClick={() => setLinkedFilter('unlinked')}
            className="ml-auto text-xs text-orange-400 hover:underline cursor-pointer"
          >
            Εμφάνιση →
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="animate-fade-in-up stagger-1 space-y-2">
        {/* Row 1: search + direction + linked */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
            <input
              className="input rounded-xl border-border/15 hover:border-border/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors w-full pl-9!"
              placeholder="Αναζήτηση με όνομα, τηλέφωνο, υπόθεση…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select shrink-0" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as typeof directionFilter)}>
            <option value="all">Όλοι οι τύποι</option>
            <option value="incoming">Εισερχόμενες</option>
            <option value="outgoing">Εξερχόμενες</option>
          </select>
          <select className="select shrink-0" value={linkedFilter} onChange={(e) => setLinkedFilter(e.target.value as typeof linkedFilter)}>
            <option value="all">Όλες οι κλήσεις</option>
            <option value="linked">Συνδεδεμένες</option>
            <option value="unlinked">Ασύνδετες</option>
          </select>
        </div>

        {/* Row 2: date presets + custom range */}
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-text-secondary shrink-0" />
          <div className="flex items-center gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => datePreset === p.value ? clearDateFilter() : applyPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  datePreset === p.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => applyPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              Προσαρμοσμένο
            </button>
          </div>

          {(datePreset === 'custom') && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="input text-xs py-1.5 rounded-lg w-auto"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-text-secondary text-xs">—</span>
              <input
                type="date"
                className="input text-xs py-1.5 rounded-lg w-auto"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          )}

          {(datePreset || dateFrom || dateTo) && (
            <button
              onClick={clearDateFilter}
              className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Καθαρισμός
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Φόρτωση κλήσεων…
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2">
          <DataTable
            tableId="calls"
            columns={columns}
            data={filteredCalls}
            rowKey={(c) => c.id}
            onRowClick={(c) => { if (c.case_id) navigate(`/cases/${c.case_id}`); }}
            rowClassName={(c) => !c.case_id ? 'bg-orange-500/5' : ''}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
                <div className="w-14 h-14 rounded-2xl bg-border/5 flex items-center justify-center">
                  <Phone className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm">
                  {search || directionFilter !== 'all' || linkedFilter !== 'all' || dateFrom || dateTo
                    ? 'Δεν βρέθηκαν κλήσεις με αυτά τα φίλτρα.'
                    : 'Δεν υπάρχουν κλήσεις ακόμα.'}
                </p>
                {!search && directionFilter === 'all' && linkedFilter === 'all' && !dateFrom && !dateTo && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs text-primary hover:underline cursor-pointer font-medium"
                  >
                    Καταγράψτε την πρώτη κλήση →
                  </button>
                )}
              </div>
            }
          />
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
