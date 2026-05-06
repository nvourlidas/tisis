import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Info, Users, Phone,
  CheckSquare, TrendingUp, FolderOpen, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCase } from './caseUtils';
import type { Case } from './types';
import CaseInfo from './components/CaseInfo';
import CaseContacts from './components/CaseContacts';
import CaseCalls from './components/CaseCalls';
import CaseTasks from './components/CaseTasks';
import CaseFinancials from './components/CaseFinancials';
import CaseFiles from './components/CaseFiles';

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

type Tab = 'info' | 'contacts' | 'calls' | 'tasks' | 'financials' | 'files';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'info',       label: 'Πληροφορίες', icon: <Info className="h-3.5 w-3.5" /> },
  { id: 'contacts',   label: 'Επαφές',      icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'calls',      label: 'Κλήσεις',     icon: <Phone className="h-3.5 w-3.5" /> },
  { id: 'tasks',      label: 'Εργασίες',    icon: <CheckSquare className="h-3.5 w-3.5" /> },
  { id: 'financials', label: 'Οικονομικά',  icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'files',      label: 'Αρχεία',      icon: <FolderOpen className="h-3.5 w-3.5" /> },
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

  if (loading) return (
    <div className="p-6 flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft">
      <RotateCcw className="h-4 w-4 animate-spin" />
      Φόρτωση υπόθεσης…
    </div>
  );
  if (!caseData) return (
    <div className="p-6 flex items-center gap-3 text-sm text-text-secondary">
      <Briefcase className="h-4 w-4 opacity-40" />
      Η υπόθεση δεν βρέθηκε.
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/cases')}
        className="animate-fade-in inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Υποθέσεις
      </button>

      {/* Header card */}
      <div className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs text-text-secondary bg-border/5 px-2 py-0.5 rounded-md border border-border/10">
                  {caseData.code}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[caseData.status] ?? ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[caseData.status] ?? ''}`} />
                  {STATUS_LABELS[caseData.status] ?? caseData.status}
                </span>
                {caseData.type && (
                  <span className="text-xs text-text-secondary bg-border/5 px-2 py-0.5 rounded-full border border-border/10">
                    {caseData.type}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-text-primary mt-1.5 leading-tight">{caseData.title}</h1>
              {caseData.client_name && (
                <p className="text-sm text-text-secondary mt-1 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {caseData.client_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up stagger-1 border-b border-border/10">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all cursor-pointer border-b-2 -mb-px',
                tab === t.id
                  ? 'text-primary border-primary'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border/30',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {tab === 'info' && (
          <CaseInfo caseData={caseData} tenantId={tenantId} onUpdate={setCaseData} />
        )}
        {tab === 'contacts' && <CaseContacts caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'calls' && <CaseCalls caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'tasks' && <CaseTasks caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'financials' && <CaseFinancials caseId={caseData.id} tenantId={tenantId} />}
        {tab === 'files' && (
          <CaseFiles
            caseId={caseData.id}
            caseCode={caseData.code}
            caseTitle={caseData.title}
            folderId={caseData.google_drive_folder_id ?? null}
            folderUrl={caseData.google_drive_url ?? null}
            onFolderCreated={(folderId, folderUrl) =>
              setCaseData((prev) => prev ? { ...prev, google_drive_folder_id: folderId, google_drive_url: folderUrl } : prev)
            }
          />
        )}
      </div>
    </div>
  );
}
