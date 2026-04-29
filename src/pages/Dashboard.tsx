import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, AlertCircle, CheckSquare, CalendarClock,
  Check, RotateCcw, PhoneIncoming, PhoneOutgoing, Plus,
  ChevronLeft, ChevronRight, X as XIcon,
} from 'lucide-react';
import { useAuth } from '../auth';
import { fetchAllTasks, completeTask, reopenTask } from './Tasks/taskUtils';
import { fetchCalls, linkCallToCase, searchCasesForCall } from './Calls/callUtils';
import { supabase } from '../lib/supabase';
import NewCallModal from './Calls/modals/NewCallModal';
import type { Task, TaskExpense } from './Tasks/taskUtils';
import type { Call } from './Calls/types';
import { formatDate } from '../lib/dateUtils';

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
    <div className="p-6 space-y-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      {formatDate(c.next_critical_date, { day: '2-digit', month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Widget>

          {/* Overdue tasks — spans full width when present */}
          {overdue.length > 0 && (
            <Widget
              icon={<AlertCircle className="h-4 w-4 text-orange-400" />}
              title={`Ληξιπρόθεσμες εργασίες (${overdue.length})`}
              titleColor="text-orange-400"
              action={{ label: 'Όλες οι εργασίες', onClick: () => navigate('/tasks') }}
              className="md:col-span-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {overdue.slice(0, 6).map((task) => (
                  <TaskRow key={task.id} task={task} toggling={toggling} onToggle={toggle} onNavigate={navigate} />
                ))}
              </div>
              {overdue.length > 6 && (
                <button onClick={() => navigate('/tasks')} className="text-xs text-orange-400 hover:underline cursor-pointer mt-1">
                  +{overdue.length - 6} ακόμα…
                </button>
              )}
            </Widget>
          )}

          {/* Unlinked calls — spans full width when present */}
          {unlinkedCalls.length > 0 && (
            <Widget
              icon={<AlertCircle className="h-4 w-4 text-orange-400" />}
              title={`Εκκρεμείς κλήσεις χωρίς υπόθεση (${unlinkedCalls.length})`}
              titleColor="text-orange-400"
              action={{ label: 'Προβολή όλων', onClick: () => navigate('/calls') }}
              className="md:col-span-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unlinkedCalls.slice(0, 4).map((call) => (
                  <UnlinkedCallRow
                    key={call.id}
                    call={call}
                    tenantId={tenantId}
                    onLinked={load}
                  />
                ))}
              </div>
              {unlinkedCalls.length > 4 && (
                <button onClick={() => navigate('/calls')} className="text-xs text-orange-400 hover:underline cursor-pointer mt-1">
                  +{unlinkedCalls.length - 4} ακόμα…
                </button>
              )}
            </Widget>
          )}
        </div>
      )}

      {/* Calendar */}
      {!loading && (
        <DashboardCalendar tasks={tasks} calls={calls} onNavigate={navigate} />
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
  icon, title, titleColor = 'text-text-primary', action, children, className = '',
}: {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border/10 bg-secondary-background p-5 space-y-3 ${className}`}>
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
          {formatDate(task.due_date, { day: '2-digit', month: '2-digit' })}
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

// ── Dashboard Calendar ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const DAY_NAMES = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];

type CalendarItem =
  | { kind: 'task'; id: string; title: string; case_id?: string | null; case_code?: string | null; case_title?: string | null; status: string; due_date: string; fee?: number | null; expenses?: TaskExpense[] | null; category?: string | null; description?: string | null }
  | { kind: 'call'; id: string; caller_name: string | null; phone: string | null; direction: string; case_id?: string | null; case_code?: string | null; case_title?: string | null; created_at: string };

function DashboardCalendar({
  tasks,
  calls,
  onNavigate,
}: {
  tasks: Task[];
  calls: Call[];
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setYear(todayDate.getFullYear());
    setMonth(todayDate.getMonth());
    setSelectedDay(todayStr);
  };

  // Map date string → items
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const add = (day: string, item: CalendarItem) => {
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(item);
    };
    for (const t of tasks) {
      if (t.due_date) add(t.due_date, { kind: 'task', id: t.id, title: t.title, case_id: t.case_id, case_code: t.case_code, case_title: t.case_title, status: t.status, due_date: t.due_date, fee: t.fee, expenses: t.expenses, category: t.category, description: t.description });
    }
    for (const c of calls) {
      const day = c.created_at.slice(0, 10);
      add(day, { kind: 'call', id: c.id, caller_name: c.caller_name, phone: c.phone, direction: c.direction, case_id: c.case_id, case_code: c.case_code, case_title: c.case_title, created_at: c.created_at });
    }
    return map;
  }, [tasks, calls]);

  // Build grid: weeks, each week is Mon..Sun
  const firstDay = new Date(year, month, 1);
  // Day of week Mon=0..Sun=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = i - startDow + 1;
    cells.push(d >= 1 && d <= daysInMonth ? d : null);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStr = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  const selectedItems = selectedDay ? (itemsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">
            {MONTH_NAMES[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className="px-2 py-1 text-xs text-primary hover:underline cursor-pointer">Σήμερα</button>
          <button onClick={prevMonth} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-text-secondary uppercase tracking-wide py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
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
                'relative min-h-16 rounded-lg p-1.5 text-left transition-colors cursor-pointer flex flex-col gap-1',
                isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white/4',
                isToday ? 'ring-1 ring-primary/50' : '',
              ].join(' ')}
            >
              <span className={[
                'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                isToday ? 'bg-primary text-white' : 'text-text-secondary',
              ].join(' ')}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {tasks_.slice(0, 2).map((item) => {
                  const overdue = item.kind === 'task' && item.status === 'open' && ds < todayStr;
                  const done = item.kind === 'task' && item.status === 'done';
                  return (
                    <span key={item.id} className={[
                      'text-[10px] leading-tight px-1 rounded truncate',
                      done ? 'bg-green-500/10 text-green-400 line-through opacity-60' :
                      overdue ? 'bg-orange-500/15 text-orange-400' :
                      'bg-primary/15 text-primary',
                    ].join(' ')}>
                      {item.kind === 'task' ? item.title : ''}
                    </span>
                  );
                })}
                {calls_.slice(0, 2).map((item) => (
                  <span key={item.id} className={[
                    'text-[10px] leading-tight px-1 rounded truncate',
                    item.kind === 'call' && item.direction === 'incoming'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-blue-500/10 text-blue-400',
                  ].join(' ')}>
                    {item.kind === 'call' ? (item.caller_name ?? item.phone ?? 'Κλήση') : ''}
                  </span>
                ))}
                {items.length > 4 && (
                  <span className="text-[10px] text-text-secondary px-1">+{items.length - 4} ακόμα</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="border-t border-border/10 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {new Date(selectedDay + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-text-secondary">Δεν υπάρχουν εγγραφές αυτή την ημέρα.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => {
                if (item.kind === 'task') {
                  const overdue = item.status === 'open' && item.due_date < todayStr;
                  const done = item.status === 'done';
                  const totalExpenses = item.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
                  const hasFinancials = item.fee || (item.expenses?.length ?? 0) > 0;
                  return (
                    <div key={item.id} className={`rounded-xl border px-4 py-3 space-y-2 ${overdue ? 'border-orange-500/20 bg-orange-500/5' : done ? 'border-green-500/20 bg-green-500/5 opacity-70' : 'border-border/10 bg-white/2'}`}>
                      <div className="flex items-start gap-3">
                        <CheckSquare className={`h-4 w-4 mt-0.5 shrink-0 ${overdue ? 'text-orange-400' : done ? 'text-green-400' : 'text-primary'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${done ? 'line-through text-text-secondary' : 'text-text-primary'}`}>{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.case_code && (
                              <button
                                onClick={() => item.case_id && onNavigate(`/cases/${item.case_id}`)}
                                className="text-xs text-primary hover:underline cursor-pointer font-mono"
                              >
                                {item.case_code} — {item.case_title}
                              </button>
                            )}
                            {item.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-text-secondary border border-border/10">
                                {item.category === 'legal_act' ? 'Νομικές Πράξεις' :
                                 item.category === 'extrajudicial' ? 'Εξοδικαστηκές' :
                                 item.category === 'appointment' ? 'Ραντεβού' : 'Εργασία Φακέλου'}
                              </span>
                            )}
                          </div>
                        </div>
                        {overdue && (
                          <span className="text-[10px] font-semibold text-orange-400 shrink-0 bg-orange-500/10 px-2 py-0.5 rounded-full">Ληξ/θεσμη</span>
                        )}
                      </div>
                      {hasFinancials && (
                        <div className="flex flex-wrap gap-3 pl-7 text-xs text-green-400">
                          {item.fee != null && item.fee > 0 && (
                            <span>Αμοιβή: <strong>{item.fee.toFixed(2)} €</strong></span>
                          )}
                          {(item.expenses?.length ?? 0) > 0 && (
                            <span className="text-red-400">Έξοδα: <strong>{totalExpenses.toFixed(2)} €</strong> ({item.expenses!.length})</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                // call
                return (
                  <div key={item.id} className="rounded-xl border border-border/10 bg-white/2 px-4 py-3 space-y-1">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${item.direction === 'incoming' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {item.direction === 'incoming' ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.caller_name && <span className="text-sm font-medium text-text-primary">{item.caller_name}</span>}
                          {item.phone && <span className="text-sm text-text-secondary font-mono">{item.phone}</span>}
                          <span className="text-xs text-text-secondary ml-auto">
                            {new Date(item.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {item.case_code && (
                          <button
                            onClick={() => item.case_id && onNavigate(`/cases/${item.case_id}`)}
                            className="text-xs text-primary hover:underline cursor-pointer mt-0.5 font-mono"
                          >
                            {item.case_code} — {item.case_title}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
