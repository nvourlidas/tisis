import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, Settings2, RotateCcw } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchCases, createCase, searchCases } from './caseUtils';
import type { Case, CaseFormData, CaseStatus, CaseType } from './types';

const TYPE_COLORS: Record<CaseType, string> = {
  'Αστικό':     'bg-blue-500/15 text-blue-500',
  'Ποινικό':    'bg-red-500/15 text-red-500',
  'Διοικητικό': 'bg-purple-500/15 text-purple-500',
  'Εμπορικό':   'bg-orange-500/15 text-orange-500',
};
import NewCaseModal from './modals/NewCaseModal';
import StagesModal from './modals/StagesModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import { fetchStages } from './caseUtils';
import type { CaseStage } from './types';

const STATUS_LABELS: Record<string, string> = {
  active:  'Ενεργή',
  pending: 'Εκκρεμής',
  closed:  'Κλειστή',
};

const STATUS_COLORS: Record<string, string> = {
  active:  'bg-green-500/15 text-green-500',
  pending: 'bg-yellow-500/15 text-yellow-600',
  closed:  'bg-border/10 text-text-secondary',
};

const STATUS_DOT: Record<string, string> = {
  active:  'bg-green-500',
  pending: 'bg-yellow-500',
  closed:  'bg-text-secondary/40',
};

const COLUMNS: ColumnDef<Case>[] = [
  {
    key: 'code',
    header: 'Κωδικός',
    render: (c) => <span className="font-mono text-xs text-text-secondary">{c.code}</span>,
    sortValue: (c) => c.code,
  },
  {
    key: 'title',
    header: 'Τίτλος',
    render: (c) => <span className="font-medium text-text-primary">{c.title}</span>,
    sortValue: (c) => c.title,
  },
  {
    key: 'client_name',
    header: 'Εντολέας',
    render: (c) => <span className="text-text-secondary">{c.client_name ?? '—'}</span>,
    sortValue: (c) => c.client_name ?? '',
  },
  {
    key: 'status',
    header: 'Κατάσταση',
    render: (c) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? ''}`} />
        {STATUS_LABELS[c.status] ?? c.status}
      </span>
    ),
    sortValue: (c) => c.status,
  },
  {
    key: 'created_at',
    header: 'Ημ/νία Δημιουργίας',
    render: (c) => <span className="text-text-secondary">{formatDate(c.created_at)}</span>,
    sortValue: (c) => c.created_at,
    defaultVisible: true,
  },
  {
    key: 'type',
    header: 'Τύπος',
    render: (c) => c.type
      ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[c.type]}`}>{c.type}</span>
      : <span className="text-text-secondary">—</span>,
    sortValue: (c) => c.type ?? '',
    defaultVisible: false,
  },
  {
    key: 'stage',
    header: 'Στάδιο',
    render: (c) => <span className="text-text-secondary">{c.stage_name ?? '—'}</span>,
    sortValue: (c) => c.stage_name ?? '',
    defaultVisible: false,
  },
];

type FilterStatus = CaseStatus | 'all';

export default function Cases() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<CaseType | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showStages, setShowStages] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchStages(tenantId).then(setStages);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (query.trim()) return;
    setLoading(true);
    fetchCases(tenantId, filter === 'all' ? undefined : filter)
      .then(setCases)
      .finally(() => setLoading(false));
  }, [tenantId, filter, query]);

  useEffect(() => {
    if (!tenantId || !query.trim()) return;
    const t = setTimeout(() => {
      searchCases(tenantId, query.trim()).then(setCases);
    }, 250);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const handleCreate = async (data: CaseFormData) => {
    const created = await createCase(tenantId, data);
    navigate(`/cases/${created.id}`);
  };

  const CASE_TYPES: CaseType[] = ['Αστικό', 'Ποινικό', 'Διοικητικό', 'Εμπορικό'];

  const visibleCases = cases.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (stageFilter !== 'all' && (c.stage_id ?? 'none') !== stageFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Υποθέσεις</h1>
          <p className="text-sm text-text-secondary mt-0.5">{visibleCases.length} υποθέσεις</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStages(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Στάδια
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Νέα Υπόθεση
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up stagger-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            className="input rounded-xl border-border/15 hover:border-border/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors w-full pl-9!"
            placeholder="Αναζήτηση με κωδικό, τίτλο…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="select shrink-0" value={filter} onChange={(e) => setFilter(e.target.value as FilterStatus)}>
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργές</option>
          <option value="pending">Εκκρεμείς</option>
          <option value="closed">Κλειστές</option>
        </select>
        <select className="select shrink-0" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CaseType | 'all')}>
          <option value="all">Όλοι οι τύποι</option>
          {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {stages.length > 0 && (
          <select className="select shrink-0" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="all">Όλα τα στάδια</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Φόρτωση υποθέσεων…
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2">
          <DataTable
            tableId="cases"
            columns={COLUMNS}
            data={visibleCases}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/cases/${c.id}`)}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary gap-3">
                <div className="w-14 h-14 rounded-2xl bg-border/5 flex items-center justify-center">
                  <Briefcase className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm">{query ? 'Δεν βρέθηκαν υποθέσεις.' : 'Δεν υπάρχουν υποθέσεις ακόμα.'}</p>
                {!query && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-xs text-primary hover:underline cursor-pointer font-medium"
                  >
                    Δημιουργήστε την πρώτη υπόθεση →
                  </button>
                )}
              </div>
            }
          />
        </div>
      )}

      <NewCaseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        tenantId={tenantId}
      />
      <StagesModal
        open={showStages}
        onClose={() => setShowStages(false)}
        tenantId={tenantId}
      />
    </div>
  );
}
