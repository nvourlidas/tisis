import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCase } from './caseUtils';
import type { Case } from './types';
import CaseInfo from './components/CaseInfo';
import CaseContacts from './components/CaseContacts';
import CaseCalls from './components/CaseCalls';
import CaseTasks from './components/CaseTasks';
import CaseFinancials from './components/CaseFinancials';

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

type Tab = 'info' | 'contacts' | 'calls' | 'tasks' | 'financials';

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Πληροφορίες' },
  { id: 'contacts', label: 'Επαφές' },
  { id: 'calls', label: 'Κλήσεις' },
  { id: 'tasks', label: 'Εργασίες' },
  { id: 'financials', label: 'Οικονομικά' },
];

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCase(id).then(setCaseData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!caseData) return <div className="p-6 text-sm text-text-secondary">Η υπόθεση δεν βρέθηκε.</div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <button
        onClick={() => navigate('/cases')}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Υποθέσεις
      </button>

      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-text-secondary">{caseData.code}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[caseData.status] ?? ''}`}>
            {STATUS_LABELS[caseData.status] ?? caseData.status}
          </span>
        </div>
        <h1 className="text-xl font-bold text-text-primary mt-0.5">{caseData.title}</h1>
        {caseData.client_name && (
          <p className="text-sm text-text-secondary mt-0.5">{caseData.client_name}</p>
        )}
      </div>

      <div className="border-b border-border/10">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all cursor-pointer border-b-2 -mb-px',
                tab === t.id
                  ? 'text-primary border-primary'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border/30',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === 'info' && (
          <CaseInfo caseData={caseData} tenantId={tenantId} onUpdate={setCaseData} />
        )}
        {tab === 'contacts' && <CaseContacts caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'calls' && <CaseCalls caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'tasks' && <CaseTasks caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'financials' && <CaseFinancials caseId={caseData.id} tenantId={tenantId} />}
      </div>
    </div>
  );
}
