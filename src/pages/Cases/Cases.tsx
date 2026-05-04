import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, Settings2 } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { useAuth } from '../../auth';
import { fetchCases, createCase, searchCases } from './caseUtils';
import type { Case, CaseFormData, CaseStatus, CaseType } from './types';

const TYPE_COLORS: Record<CaseType, string> = {
  'Αστικό': 'bg-blue-500/15 text-blue-400',
  'Ποινικό': 'bg-red-500/15 text-red-400',
  'Διοικητικό': 'bg-purple-500/15 text-purple-400',
  'Εμπορικό': 'bg-orange-500/15 text-orange-400',
};
import NewCaseModal from './modals/NewCaseModal';
import StagesModal from './modals/StagesModal';
import DataTable, { type ColumnDef } from '../../components/DataTable';
import { fetchStages } from './caseUtils';
import type { CaseStage } from './types';

const STATUS_LABELS: Record<string, string> = {
  active: 'Ενεργή',
  pending: 'Εκκρεμής',
  closed: 'Κλειστή',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  pending: 'bg-yellow-500/15 text-yellow-400',
  closed: 'bg-border/20 text-text-secondary',
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
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
        {STATUS_LABELS[c.status] ?? c.status}
      </span>
    ),
    sortValue: (c) => c.status,
  },
  {
    key: 'next_critical_date',
    header: 'Επόμενη Ημ/νία',
    render: (c) => (
      <span className="text-text-secondary">
        {c.next_critical_date
          ? formatDate(c.next_critical_date)
          : '—'}
      </span>
    ),
    sortValue: (c) => c.next_critical_date ?? '',
    defaultVisible: false,
  },
  {
    key: 'type',
    header: 'Τύπος',
    render: (c) => c.type
      ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[c.type]}`}>{c.type}</span>
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Υποθέσεις</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStages(true)} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
            <Settings2 className="h-3.5 w-3.5" />
            Στάδια
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
            <Plus className="h-4 w-4" />
            Νέα Υπόθεση
          </button>
        </div>
      </div>

      {/* Filters + search on one line */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
          <input
            className="input w-full pl-9!"
            placeholder="Αναζήτηση με κωδικό, τίτλο…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as FilterStatus)}>
          <option value="all">Όλες οι καταστάσεις</option>
          <option value="active">Ενεργές</option>
          <option value="pending">Εκκρεμείς</option>
          <option value="closed">Κλειστές</option>
        </select>
        <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CaseType | 'all')}>
          <option value="all">Όλοι οι τύποι</option>
          {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {stages.length > 0 && (
          <select className="input w-auto" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="all">Όλα τα στάδια</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : (
        <DataTable
          tableId="cases"
          columns={COLUMNS}
          data={visibleCases}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/cases/${c.id}`)}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
              <Briefcase className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">{query ? 'Δεν βρέθηκαν υποθέσεις.' : 'Δεν υπάρχουν υποθέσεις ακόμα.'}</p>
            </div>
          }
        />
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
