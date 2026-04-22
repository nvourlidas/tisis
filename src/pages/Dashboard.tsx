import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, AlertCircle, CheckSquare, CalendarClock,
  Check, RotateCcw, PhoneIncoming, PhoneOutgoing, Plus,
} from 'lucide-react';
import { useAuth } from '../auth';
import { fetchAllTasks, completeTask, reopenTask } from './Tasks/taskUtils';
import { fetchCalls, linkCallToCase, searchCasesForCall } from './Calls/callUtils';
import { supabase } from '../lib/supabase';
import NewCallModal from './Calls/modals/NewCallModal';
import type { Task } from './Tasks/taskUtils';
import type { Call } from './Calls/types';

type CriticalCase = { id: string; code: string; title: string; next_critical_date: string };

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = profile?.tenant_id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [criticalCases, setCriticalCases] = useState<CriticalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCall, setShowNewCall] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const [t, c, { data: cc }] = await Promise.all([
      fetchAllTasks(tenantId),
      fetchCalls(tenantId),
      supabase
        .from('cases')
        .select('id, code, title, next_critical_date')
        .eq('tenant_id', tenantId)
        .neq('status', 'closed')
        .gte('next_critical_date', today)
        .lte('next_critical_date', in7)
        .order('next_critical_date'),
    ]);

    setTasks(t);
    setCalls(c);
    setCriticalCases(cc ?? []);
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
  const unlinkedCalls = calls.filter((c) => !c.case_id);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header + CTA */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Πίνακας Ελέγχου</h1>
        <button
          onClick={() => setShowNewCall(true)}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer text-base"
        >
          <Phone className="h-4 w-4" />
          Νέα Κλήση
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : (
        <div className="space-y-5">
          {/* Unlinked calls — orange priority */}
          {unlinkedCalls.length > 0 && (
            <Widget
              icon={<AlertCircle className="h-4 w-4 text-orange-400" />}
              title={`Εκκρεμείς κλήσεις χωρίς υπόθεση (${unlinkedCalls.length})`}
              titleColor="text-orange-400"
              action={{ label: 'Προβολή όλων', onClick: () => navigate('/calls') }}
            >
              <div className="space-y-2">
                {unlinkedCalls.slice(0, 5).map((call) => (
                  <UnlinkedCallRow
                    key={call.id}
                    call={call}
                    tenantId={tenantId}
                    onLinked={load}
                  />
                ))}
                {unlinkedCalls.length > 5 && (
                  <button onClick={() => navigate('/calls')} className="text-xs text-orange-400 hover:underline cursor-pointer">
                    +{unlinkedCalls.length - 5} ακόμα…
                  </button>
                )}
              </div>
            </Widget>
          )}

          {/* Overdue tasks */}
          {overdue.length > 0 && (
            <Widget
              icon={<AlertCircle className="h-4 w-4 text-orange-400" />}
              title={`Ληξιπρόθεσμες εργασίες (${overdue.length})`}
              titleColor="text-orange-400"
              action={{ label: 'Όλες οι εργασίες', onClick: () => navigate('/tasks') }}
            >
              <div className="space-y-2">
                {overdue.slice(0, 5).map((task) => (
                  <TaskRow key={task.id} task={task} toggling={toggling} onToggle={toggle} onNavigate={navigate} />
                ))}
                {overdue.length > 5 && (
                  <button onClick={() => navigate('/tasks')} className="text-xs text-orange-400 hover:underline cursor-pointer">
                    +{overdue.length - 5} ακόμα…
                  </button>
                )}
              </div>
            </Widget>
          )}

          {/* Today's tasks */}
          <Widget
            icon={<CheckSquare className="h-4 w-4 text-primary" />}
            title={`Εργασίες σήμερα (${todayTasks.length})`}
            action={{ label: 'Όλες', onClick: () => navigate('/tasks') }}
          >
            {todayTasks.length === 0 ? (
              <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες για σήμερα.</p>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} toggling={toggling} onToggle={toggle} onNavigate={navigate} />
                ))}
              </div>
            )}
          </Widget>

          {/* Critical dates */}
          <Widget
            icon={<CalendarClock className="h-4 w-4 text-text-secondary" />}
            title="Κρίσιμες ημερομηνίες (επόμενες 7 ημέρες)"
            action={criticalCases.length > 0 ? { label: 'Υποθέσεις', onClick: () => navigate('/cases') } : undefined}
          >
            {criticalCases.length === 0 ? (
              <p className="text-sm text-text-secondary">Δεν υπάρχουν κρίσιμες ημερομηνίες τις επόμενες 7 ημέρες.</p>
            ) : (
              <div className="space-y-2">
                {criticalCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/10 bg-white/2 hover:bg-white/4 px-4 py-3 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-secondary">{c.code}</span>
                        <span className="text-sm text-text-primary truncate">{c.title}</span>
                      </div>
                    </div>
                    <span className="text-xs text-primary shrink-0 font-medium">
                      {new Date(c.next_critical_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Widget>
        </div>
      )}

      <NewCallModal
        open={showNewCall}
        onClose={() => setShowNewCall(false)}
        onCreated={() => load()}
      />
    </div>
  );
}

// ── Widget shell ──────────────────────────────────────────────────────────────

function Widget({
  icon, title, titleColor = 'text-text-primary', action, children,
}: {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className={`text-sm font-semibold ${titleColor}`}>{title}</h2>
        </div>
        {action && (
          <button onClick={action.onClick} className="text-xs text-primary hover:underline cursor-pointer shrink-0">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, toggling, onToggle, onNavigate }: {
  task: Task;
  toggling: string | null;
  onToggle: (t: Task) => void;
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.status === 'open' && !!task.due_date && task.due_date < today;

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${overdue ? 'border-orange-500/20 bg-orange-500/5' : 'border-border/10 bg-white/2'}`}>
      <button
        onClick={() => onToggle(task)}
        disabled={toggling === task.id}
        className={[
          'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
          task.status === 'done'
            ? 'border-green-500 bg-green-500 text-white'
            : overdue
              ? 'border-orange-400 hover:bg-orange-400/20'
              : 'border-border/30 hover:border-primary',
        ].join(' ')}
      >
        {task.status === 'done' && <Check className="h-3 w-3" />}
        {task.status === 'open' && toggling === task.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary">{task.title}</span>
        {task.case_code && (
          <button
            onClick={() => onNavigate(`/cases/${task.case_id}`)}
            className="block text-xs text-primary hover:underline cursor-pointer mt-0.5"
          >
            {task.case_code} — {task.case_title}
          </button>
        )}
      </div>
      {task.due_date && (
        <span className={`text-xs shrink-0 ${overdue ? 'text-orange-400 font-medium' : 'text-text-secondary'}`}>
          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ── Unlinked call row with inline link action ─────────────────────────────────

function UnlinkedCallRow({ call, tenantId, onLinked }: {
  call: Call;
  tenantId: string;
  onLinked: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

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
    <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
          call.direction === 'incoming' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
        }`}>
          {call.direction === 'incoming'
            ? <PhoneIncoming className="h-3 w-3" />
            : <PhoneOutgoing className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {call.caller_name && <span className="text-sm font-medium text-text-primary">{call.caller_name}</span>}
            {call.phone && <span className="text-sm text-text-secondary">{call.phone}</span>}
            <span className="text-xs text-text-secondary ml-auto">
              {new Date(call.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {call.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{call.description}</p>}
        </div>
      </div>

      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 cursor-pointer transition-colors"
        >
          <Plus className="h-3 w-3" />
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
