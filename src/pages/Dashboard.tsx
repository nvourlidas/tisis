import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, CheckSquare, CalendarClock,
  Check, RotateCcw, Plus,
  ChevronLeft, ChevronRight, X as XIcon,
  Clock, LinkIcon, Users, Briefcase, Pencil, Trash2,
} from 'lucide-react';
import { useAuth } from '../auth';
import { fetchDashboardOpenTasks, fetchTasksForMonth, completeTask, reopenTask, createTask, deleteTask } from './Tasks/taskUtils';
import { fetchCalls, linkCallToCase, searchCasesForCall, deleteCall } from './Calls/callUtils';
import { supabase } from '../lib/supabase';
import NewCallModal from './Calls/modals/NewCallModal';
import EditCallModal from './Calls/modals/EditCallModal';
import TaskDetailModal from './Tasks/TaskDetailModal';
import { CasesLineChart } from './Cases/components/CasesLineChart';
import { ClientsLineChart } from './Clients/components/ClientsLineChart';
import TaskForm, { type TaskFormValues } from './Tasks/TaskForm';
import type { Task } from './Tasks/taskUtils';
import type { Call } from './Calls/types';
import { formatDate } from '../lib/dateUtils';

function taskDueColor(dueDate: string | null | undefined, todayStr: string, status: string) {
  if (status === 'done' || !dueDate) return null;
  const diff = Math.round((new Date(dueDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000);
  if (diff <= 0) return 'red';
  if (diff <= 7) return 'purple';
  if (diff <= 20) return 'orange';
  if (diff <= 30) return 'yellow';
  return null;
}
const DUE_COLOR_CHIP: Record<string, string> = {
  red: 'bg-red-500/15 text-red-500',
  purple: 'bg-purple-500/15 text-purple-500',
  orange: 'bg-orange-500/15 text-orange-500',
  yellow: 'bg-yellow-500/15 text-yellow-500',
};
const DUE_COLOR_CARD: Record<string, string> = {
  red: 'border-red-500/20 bg-red-500/5 hover:bg-red-500/8',
  purple: 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/8',
  orange: 'border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/8',
  yellow: 'border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/8',
};
const DUE_COLOR_BTN: Record<string, string> = {
  red: 'border-red-400 hover:bg-red-400/20',
  purple: 'border-purple-400 hover:bg-purple-400/20',
  orange: 'border-orange-400 hover:bg-orange-400/20',
  yellow: 'border-yellow-400 hover:bg-yellow-400/20',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [totalClients, setTotalClients] = useState<number | null>(null);
  const [totalActiveCases, setTotalActiveCases] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewCall, setShowNewCall] = useState(false);
  const [editCall, setEditCall] = useState<Call | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [todayPage, setTodayPage] = useState(0);
  const [overduePage, setOverduePage] = useState(0);
  const PAGE_SIZE = 4;

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [t, c, { count: clientCount }, { count: activeCaseCount }] = await Promise.all([
      fetchDashboardOpenTasks(tenantId),
      fetchCalls(tenantId),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
    ]);

    setTasks(t);
    setCalls(c);
    setTotalClients(clientCount ?? 0);
    setTotalActiveCases(activeCaseCount ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const toggle = async (task: Task) => {
    setToggling(task.id);
    try {
      if (task.status === 'open') await completeTask(task.id);
      else await reopenTask(task.id);
      load();
    } finally {
      setToggling(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.status === 'open' && t.due_date && t.due_date < today);
  const todayTasks = tasks.filter((t) => t.status === 'open' && t.due_date === today);
  const unlinkedCalls = calls.filter((c) => !c.case_id && !c.no_case_intentional);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Πίνακας Ελέγχου</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowNewCall(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Phone className="h-4 w-4" />
          Νέο Γεγονός
        </button>
      </div>

      {/* ── Row 1: Metric cards side by side ── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Users className="h-5 w-5" />}
          label="Σύνολο Εντολέων"
          value={totalClients}
          color="#3b82f6"
          onClick={() => navigate('/clients')}
        />
        <MetricCard
          icon={<Briefcase className="h-5 w-5" />}
          label="Ενεργές Υποθέσεις"
          value={totalActiveCases}
          color="#22c55e"
          onClick={() => navigate('/cases')}
        />
      </div>

      {/* ── Row 2: Cases chart (left) + Today's tasks (right) ── */}
      {tenantId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <CasesLineChart tenantId={tenantId} />
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
              <RotateCcw className="h-4 w-4 animate-spin" />
              Φόρτωση δεδομένων…
            </div>
          ) : (
            <Widget
              icon={<CheckSquare className="h-4 w-4" />}
              iconColor="text-blue-500"
              iconBg="bg-blue-500/10"
              title="Εργασίες σήμερα"
              badge={todayTasks.length}
              action={{ label: 'Όλες', onClick: () => navigate('/tasks') }}
              scrollable
            >
              {todayTasks.length === 0 ? (
                <EmptyState icon={<CheckSquare className="h-8 w-8 opacity-20" />} text="Δεν υπάρχουν εργασίες για σήμερα." />
              ) : (
                <>
                  <div className="space-y-2">
                    {todayTasks.slice(todayPage * PAGE_SIZE, (todayPage + 1) * PAGE_SIZE).map((task) => (
                      <TaskRow key={task.id} task={task} toggling={toggling} onToggle={toggle} onNavigate={navigate} onSelect={setSelectedTask} />
                    ))}
                  </div>
                  <Pagination page={todayPage} total={todayTasks.length} pageSize={PAGE_SIZE} onChange={setTodayPage} />
                </>
              )}
            </Widget>
          )}
        </div>
      )}

      {/* ── Row 3: Overdue tasks (left) + Clients chart (right) ── */}
      {tenantId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {!loading && (
            <Widget
              icon={<Clock className="h-4 w-4" />}
              iconColor="text-orange-500"
              iconBg="bg-orange-500/10"
              title="Ληξιπρόθεσμες εργασίες"
              badge={overdue.length}
              badgeColor="bg-orange-500/15 text-orange-500"
              action={overdue.length > 0 ? { label: 'Όλες οι εργασίες', onClick: () => navigate('/tasks') } : undefined}
              scrollable
            >
              {overdue.length === 0 ? (
                <EmptyState icon={<Clock className="h-8 w-8 opacity-20" />} text="Δεν υπάρχουν ληξιπρόθεσμες εργασίες." />
              ) : (
                <>
                  <div className="space-y-2">
                    {overdue.slice(overduePage * PAGE_SIZE, (overduePage + 1) * PAGE_SIZE).map((task) => (
                      <TaskRow key={task.id} task={task} toggling={toggling} onToggle={toggle} onNavigate={navigate} onSelect={setSelectedTask} />
                    ))}
                  </div>
                  <Pagination page={overduePage} total={overdue.length} pageSize={PAGE_SIZE} onChange={setOverduePage} />
                </>
              )}
            </Widget>
          )}
          <ClientsLineChart tenantId={tenantId} />
        </div>
      )}

      {/* ── Row 4: Unlinked calls ── */}
      {!loading && unlinkedCalls.length > 0 && (
        <Widget
          icon={<Phone className="h-4 w-4" />}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          title="Γεγονότα χωρίς υπόθεση"
          badge={unlinkedCalls.length}
          badgeColor="bg-amber-500/15 text-amber-500"
          action={{ label: 'Προβολή όλων', onClick: () => navigate('/calls') }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unlinkedCalls.slice(0, 4).map((call) => (
              <UnlinkedCallRow key={call.id} call={call} tenantId={tenantId} onLinked={load} onEdit={setEditCall} onDeleted={load} />
            ))}
          </div>
          {unlinkedCalls.length > 4 && (
            <button onClick={() => navigate('/calls')} className="text-xs text-amber-500 hover:underline cursor-pointer mt-1">
              +{unlinkedCalls.length - 4} ακόμα…
            </button>
          )}
        </Widget>
      )}

      {/* Calendar */}
      {tenantId && (
        <DashboardCalendar
          calls={calls}
          onNavigate={navigate}
          tenantId={tenantId}
          onTaskCreated={load}
          onToggleTask={toggle}
          toggling={toggling}
          onSelectTask={setSelectedTask}
          onEditCall={(id) => setEditCall(calls.find(c => c.id === id) ?? null)}
          onDeleteCall={async (id) => { if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return; await deleteCall(id); load(); }}
          onDeleteTask={async (id) => { if (!confirm('Διαγραφή εργασίας; Η ενέργεια δεν αναιρείται.')) return; await deleteTask(id); load(); }}
        />
      )}

      <NewCallModal
        open={showNewCall}
        onClose={() => setShowNewCall(false)}
        onCreated={() => load()}
      />
      <EditCallModal
        open={editCall !== null}
        call={editCall}
        onClose={() => setEditCall(null)}
        onUpdated={() => { setEditCall(null); load(); }}
      />
      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onNavigateToCase={(caseId) => { setSelectedTask(null); navigate(`/cases/${caseId}`); }}
      />
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha = 0.12) {
  const m = hex.replace('#', '');
  const bigint = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MetricCard({ icon, label, value, color, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="animate-fade-in-up text-left flex items-center gap-3 rounded-xl p-4 w-full transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      style={{ backgroundColor: hexToRgba(color, 0.12), borderLeft: `4px solid ${color}` }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
        style={{ backgroundColor: hexToRgba(color, 0.18), color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none" style={{ color }}>
          {value === null ? '…' : value}
        </p>
        <p className="text-xs text-text-secondary mt-1">{label}</p>
      </div>
    </button>
  );
}

// ── Widget shell ──────────────────────────────────────────────────────────────

function Widget({
  icon, iconColor, iconBg, title, badge, badgeLabel, badgeColor,
  action, children, className = '', delay = '', scrollable = false,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  badge?: number;
  badgeLabel?: string;
  badgeColor?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
  delay?: string;
  scrollable?: boolean;
}) {
  const bc = badgeColor ?? 'bg-primary/10 text-primary';
  return (
    <div className={`animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background p-5 ${scrollable ? 'flex flex-col h-full' : 'space-y-3'} ${className} ${delay}`}>
      <div className={`flex items-center justify-between gap-2 ${scrollable ? 'mb-3 shrink-0' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
            {icon}
          </div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {badge !== undefined && badge > 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bc}`}>
              {badge}{badgeLabel ? ` ${badgeLabel}` : ''}
            </span>
          )}
        </div>
        {action && (
          <button onClick={action.onClick} className="text-xs text-primary hover:underline cursor-pointer shrink-0 font-medium">
            {action.label} →
          </button>
        )}
      </div>
      <div className={scrollable ? 'flex-1 overflow-y-auto min-h-0' : ''}>
        {children}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border/10 mt-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-text-secondary">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-text-secondary">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, toggling, onToggle, onNavigate, onSelect }: {
  task: Task;
  toggling: string | null;
  onToggle: (t: Task) => void;
  onNavigate: ReturnType<typeof useNavigate>;
  onSelect?: (t: Task) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const color = taskDueColor(task.due_date, today, task.status);

  return (
    <div
      onClick={() => onSelect?.(task)}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${onSelect ? 'cursor-pointer' : ''} ${
        color ? DUE_COLOR_CARD[color] : 'border-border/10 bg-background hover:bg-secondary-background'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
        disabled={toggling === task.id}
        className={[
          'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
          task.status === 'done'
            ? 'border-green-500 bg-green-500 text-white'
            : color
              ? DUE_COLOR_BTN[color]
              : 'border-border/30 hover:border-primary hover:bg-primary/10',
        ].join(' ')}
      >
        {task.status === 'done' && <Check className="h-3 w-3" />}
        {task.status === 'open' && toggling === task.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary">{task.title}</span>
        {task.case_code && (
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(`/cases/${task.case_id}`); }}
            className="block text-xs text-primary hover:underline cursor-pointer mt-0.5 font-mono"
          >
            {task.case_code} — {task.case_title}
          </button>
        )}
        {task.client_name && (
          <span className="block text-xs text-text-secondary mt-0.5">{task.client_name}</span>
        )}
      </div>
      {task.due_date && (
        <span className={`text-xs shrink-0 px-2 py-0.5 rounded-full font-medium ${
          color ? DUE_COLOR_CHIP[color] : 'bg-border/5 text-text-secondary'
        }`}>
          {formatDate(task.due_date, { day: '2-digit', month: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ── Unlinked call row ─────────────────────────────────────────────────────────

function UnlinkedCallRow({ call, tenantId, onLinked, onEdit, onDeleted }: {
  call: Call;
  tenantId: string;
  onLinked: () => void;
  onEdit: (call: Call) => void;
  onDeleted: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return;
    setDeleting(true);
    try {
      await deleteCall(call.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!linking || !query.trim()) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const results = await searchCasesForCall(tenantId, query.trim());
      setOptions(results);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, linking, tenantId]);

  const doLink = async (caseId: string) => {
    setSaving(true);
    try {
      await linkCallToCase(call.id, caseId);
      onLinked();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3 space-y-2 hover:border-amber-500/25 transition-colors group">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          call.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
        }`}>
          {call.direction === 'phone'
            ? <Phone className="h-3.5 w-3.5" />
            : <Users className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {call.caller_name && <span className="text-sm font-medium text-text-primary">{call.caller_name}</span>}
            {call.phone && <span className="text-sm text-text-secondary font-mono">{call.phone}</span>}
            <span className="text-xs text-text-secondary ml-auto">
              {new Date(call.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {call.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{call.description}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => onEdit(call)}
            className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
            title="Επεξεργασία"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            disabled={deleting}
            onClick={doDelete}
            className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer transition-colors disabled:opacity-50"
            title="Διαγραφή"
          >
            {deleting ? <RotateCcw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400 cursor-pointer transition-colors bg-amber-500/10 hover:bg-amber-500/15 px-2.5 py-1 rounded-lg"
        >
          <LinkIcon className="h-3 w-3" />
          Σύνδεση με υπόθεση
        </button>
      ) : (
        <div className="space-y-1.5">
          <input
            className="input w-full text-sm py-1.5"
            placeholder="Αναζήτηση υπόθεσης…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <p className="text-xs text-text-secondary">Αναζήτηση…</p>}
          {options.length > 0 && (
            <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10">
              {options.map((c) => (
                <button
                  key={c.id}
                  disabled={saving}
                  onClick={() => doLink(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors text-left"
                >
                  <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
                  <span className="text-sm text-text-primary truncate">{c.title}</span>
                </button>
              ))}
            </div>
          )}
          {query.trim() && !searching && options.length === 0 && (
            <p className="text-xs text-text-secondary">Δεν βρέθηκαν υποθέσεις.</p>
          )}
          <button onClick={() => { setLinking(false); setQuery(''); }} className="text-xs text-text-secondary hover:text-text-primary cursor-pointer">
            Ακύρωση
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Calendar ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const DAY_NAMES = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];

type CalendarItem =
  | { kind: 'task'; id: string; title: string; case_id?: string | null; case_code?: string | null; case_title?: string | null; status: string; due_date: string; category?: string | null; description?: string | null }
  | { kind: 'call'; id: string; caller_name: string | null; phone: string | null; direction: string; case_id?: string | null; case_code?: string | null; case_title?: string | null; created_at: string };

type CalendarView = 'month' | 'week' | 'day';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function DashboardCalendar({
  calls, onNavigate, tenantId, onTaskCreated, onToggleTask, toggling, onSelectTask, onEditCall, onDeleteCall, onDeleteTask,
}: {
  calls: Call[];
  onNavigate: ReturnType<typeof useNavigate>;
  tenantId: string;
  onTaskCreated: () => void;
  onToggleTask: (t: Task) => void;
  toggling: string | null;
  onSelectTask: (t: Task) => void;
  onEditCall: (id: string) => void;
  onDeleteCall: (id: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const [view, setView] = useState<CalendarView>('month');
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string>(todayStr);
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasksForMonth(tenantId, year, month).then(({ tasks: t }) => setTasks(t));
  }, [tenantId, year, month]);

  const handleCreateTask = async (values: TaskFormValues) => {
    setCreating(true);
    setCreateError(null);
    try {
      await createTask(tenantId, {
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        case_id: values.case_id,
        category: values.category || undefined,
        extra_data: values.extra_data,
      });
      setNewTaskDate(null);
      onTaskCreated();
      fetchTasksForMonth(tenantId, year, month).then(({ tasks: t }) => setTasks(t));
    } catch (err: any) {
      setCreateError(err?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setCreating(false);
    }
  };

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); setSelectedDay(null); };
  const goToday = () => { setYear(todayDate.getFullYear()); setMonth(todayDate.getMonth()); setSelectedDay(todayStr); setAnchor(todayStr); };
  const prevPeriod = () => { if (view === 'week') setAnchor(a => addDays(a, -7)); else if (view === 'day') setAnchor(a => addDays(a, -1)); else prevMonth(); };
  const nextPeriod = () => { if (view === 'week') setAnchor(a => addDays(a, 7)); else if (view === 'day') setAnchor(a => addDays(a, 1)); else nextMonth(); };

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const add = (day: string, item: CalendarItem) => { if (!map.has(day)) map.set(day, []); map.get(day)!.push(item); };
    for (const t of tasks) {
      if (t.due_date) add(t.due_date, { kind: 'task', id: t.id, title: t.title, case_id: t.case_id, case_code: t.case_code, case_title: t.case_title, status: t.status, due_date: t.due_date, category: t.category, description: t.description });
    }
    for (const c of calls) {
      const day = c.created_at.slice(0, 10);
      add(day, { kind: 'call', id: c.id, caller_name: c.caller_name, phone: c.phone, direction: c.direction, case_id: c.case_id, case_code: c.case_code, case_title: c.case_title, created_at: c.created_at });
    }
    return map;
  }, [tasks, calls]);

  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) { const d = i - startDow + 1; cells.push(d >= 1 && d <= daysInMonth ? d : null); }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStr = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const selectedItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : [];

  const weekDays = useMemo(() => { const start = weekStart(anchor); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }, [anchor]);

  const headerTitle = useMemo(() => {
    if (view === 'month') return `${MONTH_NAMES[month]} ${year}`;
    if (view === 'week') {
      const s = new Date(weekDays[0] + 'T00:00:00');
      const e = new Date(weekDays[6] + 'T00:00:00');
      const sm = MONTH_NAMES[s.getMonth()];
      const em = MONTH_NAMES[e.getMonth()];
      return sm === em ? `${s.getDate()}–${e.getDate()} ${sm} ${e.getFullYear()}` : `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    }
    return new Date(anchor + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [view, month, year, weekDays, anchor]);

  return (
    <div className="animate-fade-in-up stagger-5 rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <CalendarClock className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary">{headerTitle}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border/15 overflow-hidden text-xs bg-background">
            {(['month', 'week', 'day'] as CalendarView[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); if (v !== 'month') setAnchor(selectedDay ?? todayStr); }}
                className={`px-2.5 py-1 cursor-pointer transition-all ${view === v ? 'bg-primary text-white font-semibold' : 'text-text-secondary hover:bg-border/5'}`}
              >
                {v === 'month' ? 'Μήνας' : v === 'week' ? 'Εβδομάδα' : 'Ημέρα'}
              </button>
            ))}
          </div>
          <button onClick={goToday} className="px-2.5 py-1 text-xs text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-colors font-medium">Σήμερα</button>
          <button onClick={prevPeriod} className="p-1.5 rounded-lg hover:bg-border/5 text-text-secondary cursor-pointer transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={nextPeriod} className="p-1.5 rounded-lg hover:bg-border/5 text-text-secondary cursor-pointer transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && (<>
        <div className="grid grid-cols-7 gap-px">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-text-secondary uppercase tracking-widest py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const ds = dayStr(day);
            const items = itemsByDay.get(ds) ?? [];
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDay;
            const tasks_ = items.filter(x => x.kind === 'task');
            const calls_ = items.filter(x => x.kind === 'call');
            return (
              <button
                key={ds}
                onClick={() => setSelectedDay(isSelected ? null : ds)}
                className={[
                  'relative min-h-16 rounded-lg p-1.5 text-left transition-all cursor-pointer flex flex-col gap-1',
                  isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-border/5',
                  isToday && !isSelected ? 'ring-1 ring-primary/40' : '',
                ].join(' ')}
              >
                <span className={['text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0 transition-colors', isToday ? 'bg-primary text-white shadow-sm shadow-primary/40' : 'text-text-secondary hover:text-text-primary'].join(' ')}>
                  {day}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {tasks_.slice(0, 2).map((item) => {
                    const done = item.kind === 'task' && item.status === 'done';
                    const col = item.kind === 'task' ? taskDueColor(item.due_date, todayStr, item.status) : null;
                    return (
                      <span key={item.id} className={['text-[13px] leading-tight px-1.5 py-0.5 rounded-md truncate', done ? 'bg-green-500/10 text-green-500 opacity-60' : col ? DUE_COLOR_CHIP[col] : 'bg-primary/15 text-primary'].join(' ')}>
                        {item.kind === 'task' ? item.title : ''}
                      </span>
                    );
                  })}
                  {calls_.slice(0, 1).map((item) => (
                    <span key={item.id} className={['text-[13px] leading-tight px-1.5 py-0.5 rounded-md truncate', item.kind === 'call' && item.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'].join(' ')}>
                      {item.kind === 'call' ? (item.caller_name ?? item.phone ?? 'Γεγονός') : ''}
                    </span>
                  ))}
                  {items.length > 3 && <span className="text-[13px] text-text-secondary px-1">+{items.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {selectedDay && (
          <DayPanel day={selectedDay} items={selectedItems} todayStr={todayStr} onNavigate={onNavigate} onClose={() => setSelectedDay(null)} onAddTask={setNewTaskDate} onToggleTask={onToggleTask} toggling={toggling} onSelectTask={onSelectTask} onEditCall={onEditCall} onDeleteCall={onDeleteCall} onDeleteTask={onDeleteTask} />
        )}
      </>)}

      {/* Week view */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((ds) => {
            const d = new Date(ds + 'T00:00:00');
            const items = itemsByDay.get(ds) ?? [];
            const isToday = ds === todayStr;
            const isSelected = ds === anchor;
            return (
              <div
                key={ds}
                onClick={() => setAnchor(ds)}
                className={['rounded-lg p-2 flex flex-col gap-1 min-h-36 cursor-pointer transition-all', isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-border/5', isToday && !isSelected ? 'ring-1 ring-primary/40' : ''].join(' ')}
              >
                <div className="flex flex-col items-center pb-1 border-b border-border/10">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                  <span className={['text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors', isToday ? 'bg-primary text-white shadow-sm shadow-primary/40' : 'text-text-primary'].join(' ')}>{d.getDate()}</span>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {items.map((item) => {
                    if (item.kind === 'task') {
                      const done = item.status === 'done';
                      const col = taskDueColor(item.due_date, todayStr, item.status);
                      return (
                        <span key={item.id} className={['text-[13px] leading-tight px-1.5 py-0.5 rounded-md truncate block', done ? 'bg-green-500/10 text-green-500 opacity-60' : col ? DUE_COLOR_CHIP[col] : 'bg-primary/15 text-primary'].join(' ')}>
                          {item.title}
                        </span>
                      );
                    }
                    return (
                      <span key={item.id} className={['text-[13px] leading-tight px-1.5 py-0.5 rounded-md truncate block', item.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'].join(' ')}>
                        {item.caller_name ?? item.phone ?? 'Γεγονός'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {view === 'week' && (
        <DayPanel day={anchor} items={itemsByDay.get(anchor) ?? []} todayStr={todayStr} onNavigate={onNavigate} onClose={undefined} onAddTask={setNewTaskDate} onToggleTask={onToggleTask} toggling={toggling} onSelectTask={onSelectTask} onEditCall={onEditCall} onDeleteCall={onDeleteCall} onDeleteTask={onDeleteTask} />
      )}

      {/* Day view */}
      {view === 'day' && (
        <DayPanel day={anchor} items={itemsByDay.get(anchor) ?? []} todayStr={todayStr} onNavigate={onNavigate} onClose={undefined} onAddTask={setNewTaskDate} onToggleTask={onToggleTask} toggling={toggling} onSelectTask={onSelectTask} onEditCall={onEditCall} onDeleteCall={onDeleteCall} onDeleteTask={onDeleteTask} />
      )}

      {/* New task modal */}
      {newTaskDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
              <h2 className="text-base font-semibold text-text-primary">Νέα Εργασία</h2>
              <button onClick={() => { setNewTaskDate(null); setCreateError(null); }} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer transition-colors">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <TaskForm
                tenantId={tenantId}
                initial={{ due_date: newTaskDate }}
                saving={creating}
                error={createError}
                onSubmit={handleCreateTask}
                onCancel={() => { setNewTaskDate(null); setCreateError(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayPanel({ day, items, todayStr, onNavigate, onClose, onAddTask, onToggleTask, toggling, onSelectTask, onEditCall, onDeleteCall, onDeleteTask }: {
  day: string;
  items: CalendarItem[];
  todayStr: string;
  onNavigate: ReturnType<typeof useNavigate>;
  onClose?: () => void;
  onAddTask: (date: string) => void;
  onToggleTask: (t: Task) => void;
  toggling: string | null;
  onSelectTask: (t: Task) => void;
  onEditCall: (id: string) => void;
  onDeleteCall: (id: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  return (
    <div className="border-t border-border/10 pt-4 space-y-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {new Date(day + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddTask(day)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer transition-colors border border-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Νέα Εργασία
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-border/5 text-text-secondary cursor-pointer transition-colors">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">Δεν υπάρχουν εγγραφές αυτή την ημέρα.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            if (item.kind === 'task') {
              const done = item.status === 'done';
              const col = taskDueColor(item.due_date, todayStr, item.status);
              return (
                <div key={item.id} onClick={() => onSelectTask(item as unknown as Task)} className={`rounded-xl border px-4 py-3 space-y-2 transition-all cursor-pointer ${col ? DUE_COLOR_CARD[col] : done ? 'border-green-500/15 bg-green-500/5 opacity-70 hover:opacity-90' : 'border-border/10 bg-background hover:bg-secondary-background'}`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleTask(item as unknown as Task); }}
                      disabled={toggling === item.id}
                      className={[
                        'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
                        done ? 'border-green-500 bg-green-500 text-white' : col ? DUE_COLOR_BTN[col] : 'border-border/30 hover:border-primary hover:bg-primary/10',
                      ].join(' ')}
                    >
                      {done && <Check className="h-3 w-3" />}
                      {!done && toggling === item.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${done ? 'text-text-secondary' : 'text-text-primary'}`}>{item.title}</p>
                      {item.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {item.case_code && (
                          <button onClick={(e) => { e.stopPropagation(); item.case_id && onNavigate(`/cases/${item.case_id}`); }} className="text-xs text-primary hover:underline cursor-pointer font-mono">
                            {item.case_code} — {item.case_title}
                          </button>
                        )}
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/5 text-text-secondary border border-border/10">
                            {item.category === 'legal_act' ? 'Νομικές Πράξεις' : item.category === 'extrajudicial' ? 'Εξωδικαστικές' : item.category === 'appointment' ? 'Ραντεβού' : 'Εργασία Φακέλου'}
                          </span>
                        )}
                      </div>
                    </div>
                    {col && (
                      <span className={`text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full ${DUE_COLOR_CHIP[col]}`}>
                        {col === 'red' ? 'Ληξ/θεσμη' : col === 'purple' ? '≤7 ημ.' : col === 'orange' ? '≤20 ημ.' : '≤30 ημ.'}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(item.id); }}
                      className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer shrink-0"
                      title="Διαγραφή"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={item.id} className="rounded-xl border border-border/10 bg-background px-4 py-3 space-y-1 hover:border-border/20 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${item.direction === 'phone' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {item.direction === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.caller_name && <span className="text-sm font-medium text-text-primary">{item.caller_name}</span>}
                      {item.phone && <span className="text-sm text-text-secondary font-mono">{item.phone}</span>}
                      <span className="text-xs text-text-secondary ml-auto">
                        {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </div>
                    {item.case_code && (
                      <button onClick={() => item.case_id && onNavigate(`/cases/${item.case_id}`)} className="text-xs text-primary hover:underline cursor-pointer mt-0.5 font-mono">
                        {item.case_code} — {item.case_title}
                      </button>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => onEditCall(item.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                      title="Επεξεργασία"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteCall(item.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer transition-colors"
                      title="Διαγραφή"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
