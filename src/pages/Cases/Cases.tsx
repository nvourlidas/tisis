import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCases, createCase, searchCases } from './caseUtils';
import type { Case, CaseFormData, CaseStatus } from './types';
import NewCaseModal from './modals/NewCaseModal';

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

type FilterStatus = CaseStatus | 'all';

export default function Cases() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showCreate, setShowCreate] = useState(false);

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

  const filters: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'Όλες' },
    { value: 'active', label: 'Ενεργές' },
    { value: 'pending', label: 'Εκκρεμείς' },
    { value: 'closed', label: 'Κλειστές' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Υποθέσεις</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Νέα Υπόθεση
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
              filter === f.value
                ? 'bg-primary/15 text-primary border border-primary/20'
                : 'bg-white/5 text-text-secondary border border-border/10 hover:bg-white/8 hover:text-text-primary',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
        <input
          className="input w-full pl-9"
          placeholder="Αναζήτηση με κωδικό, τίτλο…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Briefcase className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{query ? 'Δεν βρέθηκαν υποθέσεις.' : 'Δεν υπάρχουν υποθέσεις ακόμα.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Κωδικός</th>
                <th className="text-left px-4 py-3 font-medium">Τίτλος</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Πελάτης</th>
                <th className="text-left px-4 py-3 font-medium">Κατάσταση</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Επόμενη Ημ/νία</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="hover:bg-white/3 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{c.code}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{c.title}</td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{c.client_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ''}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                    {c.next_critical_date
                      ? new Date(c.next_critical_date + 'T00:00:00').toLocaleDateString('el-GR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewCaseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        tenantId={tenantId}
      />
    </div>
  );
}
