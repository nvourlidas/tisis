import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import {
  Plus, Check, RotateCcw, AlertCircle,
  X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, RefreshCw, Link2, Search, Phone, Users, Trash2, Mail,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { supabase } from '../../lib/supabase';
import {
  fetchTasksForMonth, fetchTaskCounts, fetchDashboardOpenTasks, completeTask, reopenTask, createTask, updateTask, deleteTask,
  searchFullTasks,
  TASK_CATEGORIES, type Task, type TaskCategory, type LegalActData, type AppointmentData, type CourtData,
} from './taskUtils';
import { fetchCallsForMonth, deleteCall, searchCalls } from '../Calls/callUtils';
import EditCallModal from '../Calls/modals/EditCallModal';
import type { Call } from '../Calls/types';
import TaskForm, { type TaskFormValues, taskToFormValues } from './TaskForm';

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const DAY_NAMES = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'];

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
  red: 'border-red-500/20 bg-red-500/5',
  purple: 'border-purple-500/20 bg-purple-500/5',
  orange: 'border-orange-500/20 bg-orange-500/5',
  yellow: 'border-yellow-500/20 bg-yellow-500/5',
};
const DUE_COLOR_BTN: Record<string, string> = {
  red: 'border-red-400 hover:bg-red-400/20',
  purple: 'border-purple-400 hover:bg-purple-400/20',
  orange: 'border-orange-400 hover:bg-orange-400/20',
  yellow: 'border-yellow-400 hover:bg-yellow-400/20',
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  legal_act: 'bg-blue-500/15 text-blue-500',
  lawsuit: 'bg-indigo-500/15 text-indigo-500',
  extrajudicial: 'bg-purple-500/15 text-purple-500',
  appointment: 'bg-teal-500/15 text-teal-500',
  file_work: 'bg-amber-500/15 text-amber-500',
  court: 'bg-black/70 text-white font-semibold',
};

export default function Tasks() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const tenantId = profile?.tenant_id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [noDueDateTasksRaw, setNoDueDateTasksRaw] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<{ open: number; done: number }>({ open: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingCall, setEditingCall] = useState<Call | null>(null);
  const [showOverdue, setShowOverdue] = useState(false);

  const doDeleteTask = async (t: Task) => {
    if (!confirm('Διαγραφή εργασίας; Η ενέργεια δεν αναιρείται.')) return;
    await deleteTask(t.id);
    load(year, month);
  };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Task[]>([]);
  const [searchCallResults, setSearchCallResults] = useState<Call[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchYear, setSearchYear] = useState<number | null>(null);
  const [searchMonth, setSearchMonth] = useState<number | null>(null);
  const [searchSortDesc, setSearchSortDesc] = useState(true);

  useEffect(() => {
    if (!searchQuery.trim() || !tenantId) { setSearchResults([]); setSearchCallResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const [tasks, calls] = await Promise.all([
          searchFullTasks(tenantId, searchQuery.trim()),
          searchCalls(tenantId, searchQuery.trim()),
        ]);
        setSearchResults(tasks);
        setSearchCallResults(calls);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, tenantId]);

  // Filters
  const [showOnlyCalls, setShowOnlyCalls] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | null>(null);
  const [authorityFilter, setAuthorityFilter] = useState('');
  const [gakFilter, setGakFilter] = useState('');
  const [eakFilter, setEakFilter] = useState('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const LAST_DAY_KEY = 'tasks-last-selected-day';
  const storedDay = navigationType === 'POP' ? sessionStorage.getItem(LAST_DAY_KEY) : null;
  const initialDay = storedDay ?? todayStr;
  const initialDate = new Date(initialDay + 'T00:00:00');

  const [view, setView] = useState<CalendarView>('month');
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDay);
  const [anchor, setAnchor] = useState<string>(initialDay);
  const todayCellRef = useRef<HTMLButtonElement>(null);
  const selectedCellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedDay) sessionStorage.setItem(LAST_DAY_KEY, selectedDay);
  }, [selectedDay]);

  useEffect(() => {
    if (loading || view !== 'month') return;
    const target = selectedDay && year === new Date(selectedDay + 'T00:00:00').getFullYear() && month === new Date(selectedDay + 'T00:00:00').getMonth()
      ? selectedCellRef.current
      : todayCellRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, view, year, month]);

  const load = (y: number, m: number) => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([
      fetchTasksForMonth(tenantId, y, m),
      fetchTaskCounts(tenantId),
      fetchCallsForMonth(tenantId, y, m),
      fetchDashboardOpenTasks(tenantId),
    ]).then(([{ tasks: t, noDueDateTasks: nd }, c, cl, ov]) => {
      setTasks(t);
      setNoDueDateTasksRaw(nd);
      setCounts(c);
      setCalls(cl);
      setOverdueTasks(ov);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(year, month); }, [tenantId, year, month]);

  const toggle = async (task: Task) => {
    setToggling(task.id);
    try {
      if (task.status === 'open') await completeTask(task.id);
      else await reopenTask(task.id);
      load(year, month);
    } finally {
      setToggling(null);
    }
  };

  const handleCreate = async (values: TaskFormValues) => {
    setCreating(true);
    setCreateError(null);
    try {
      await createTask(tenantId, {
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        due_time: values.due_time || undefined,
        case_id: values.case_id,
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
        linked_task_ids: values.linked_task_ids,
      });
      setShowCreate(false);
      load(year, month);
    } catch (err: any) {
      setCreateError(err?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (values: TaskFormValues) => {
    if (!editingTask) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTask({
        id: editingTask.id,
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        due_time: values.due_time || undefined,
        case_id: values.case_id || null,
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
        linked_task_ids: values.linked_task_ids,
      });
      setEditingTask(null);
      load(year, month);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-import', { body: {} });
      if (error) throw error;
      setSyncMsg(data.imported > 0 ? `Συγχρονίστηκαν ${data.imported} εργασίες.` : 'Δεν υπάρχουν εργασίες για συγχρονισμό.');
      if (data.imported > 0) load(year, month);
    } catch (e: any) {
      setSyncMsg(e?.message ?? 'Αποτυχία συγχρονισμού.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

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
    setAnchor(todayStr);
  };
  const prevPeriod = () => {
    if (view === 'week') setAnchor(a => addDays(a, -7));
    else if (view === 'day') setAnchor(a => addDays(a, -1));
    else prevMonth();
  };
  const nextPeriod = () => {
    if (view === 'week') setAnchor(a => addDays(a, 7));
    else if (view === 'day') setAnchor(a => addDays(a, 1));
    else nextMonth();
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if ((categoryFilter === 'legal_act' || categoryFilter === 'lawsuit') && t.extra_data) {
        const d = t.extra_data as LegalActData;
        if (authorityFilter && !d.authority?.toLowerCase().includes(authorityFilter.toLowerCase())) return false;
        if (gakFilter && !d.gak?.toLowerCase().includes(gakFilter.toLowerCase())) return false;
        if (eakFilter && !d.eak?.toLowerCase().includes(eakFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [tasks, categoryFilter, authorityFilter, gakFilter, eakFilter]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filteredTasks) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
    }
    for (const arr of map.values()) arr.sort((a, b) => {
      if (a.category === 'court' && b.category !== 'court') return -1;
      if (b.category === 'court' && a.category !== 'court') return 1;
      return (a.due_time ?? '99:99').localeCompare(b.due_time ?? '99:99');
    });
    return map;
  }, [filteredTasks]);

  const callsByDay = useMemo(() => {
    const map = new Map<string, Call[]>();
    for (const c of calls) {
      const day = c.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(c);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return map;
  }, [calls]);

  type DayItem = { type: 'task'; item: Task } | { type: 'call'; item: Call };
  const dayItemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    for (const t of filteredTasks) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push({ type: 'task', item: t });
    }
    for (const c of calls) {
      const day = c.created_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push({ type: 'call', item: c });
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const aIsCourt = a.type === 'task' && (a.item as Task).category === 'court';
        const bIsCourt = b.type === 'task' && (b.item as Task).category === 'court';
        if (aIsCourt && !bIsCourt) return -1;
        if (bIsCourt && !aIsCourt) return 1;
        const ta = a.type === 'task' ? (a.item.due_time ?? '99:99') : new Date(a.item.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).toTimeString().slice(0, 5);
        const tb = b.type === 'task' ? (b.item.due_time ?? '99:99') : new Date(b.item.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).toTimeString().slice(0, 5);
        return ta.localeCompare(tb);
      });
    }
    return map;
  }, [filteredTasks, calls]);

  const noDueDateTasks = useMemo(() => {
    const fromFetched = noDueDateTasksRaw.filter(t => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if ((categoryFilter === 'legal_act' || categoryFilter === 'lawsuit') && t.extra_data) {
        const d = t.extra_data as LegalActData;
        if (authorityFilter && !d.authority?.toLowerCase().includes(authorityFilter.toLowerCase())) return false;
        if (gakFilter && !d.gak?.toLowerCase().includes(gakFilter.toLowerCase())) return false;
        if (eakFilter && !d.eak?.toLowerCase().includes(eakFilter.toLowerCase())) return false;
      }
      return true;
    });
    return fromFetched;
  }, [noDueDateTasksRaw, categoryFilter, authorityFilter, gakFilter, eakFilter]);

  const firstDay = new Date(year, month, 1);
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

  const selectedTasks = selectedDay ? (tasksByDay.get(selectedDay) ?? []) : [];

  const weekDays = useMemo(() => {
    const start = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const headerTitle = useMemo(() => {
    if (view === 'month') return `${MONTH_NAMES[month]} ${year}`;
    if (view === 'week') {
      const s = new Date(weekDays[0] + 'T00:00:00');
      const e = new Date(weekDays[6] + 'T00:00:00');
      const sm = MONTH_NAMES[s.getMonth()];
      const em = MONTH_NAMES[e.getMonth()];
      return sm === em
        ? `${s.getDate()}–${e.getDate()} ${sm} ${e.getFullYear()}`
        : `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    }
    return new Date(anchor + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [view, month, year, weekDays, anchor]);

  const openCount = counts.open;

  return (
    <div className="p-6 space-y-5">
      {showOverdue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOverdue(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-orange-500/20 bg-secondary-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-secondary-background px-6 py-4 border-b border-border/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-text-primary">Ληξιπρόθεσμες εργασίες</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500">{overdueTasks.length}</span>
              </div>
              <button onClick={() => setShowOverdue(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-2">
              {overdueTasks.map(task => (
                <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                  onToggle={toggle} onEdit={t => { setEditingTask(t); setShowOverdue(false); }} onDelete={doDeleteTask} onNavigate={navigate} />
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Ημερολόγιο</h1>
          {!loading && (
            <p className="text-sm text-text-secondary mt-0.5">
              {openCount} ανοιχτές · {counts.done} ολοκληρωμένες
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 h-9 w-56 rounded-xl border border-border/10 bg-secondary-background px-3">
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Αναζήτηση εργασιών…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-white/10 text-text-secondary cursor-pointer shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {syncMsg && (
            <span className="text-xs text-text-secondary animate-fade-in">{syncMsg}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/20 bg-white/4 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Google Calendar
          </button>
          {overdueTasks.length > 0 && (
            <button
              onClick={() => setShowOverdue(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer"
            >
              <AlertCircle className="h-4 w-4" />
              Ληξιπρόθεσμες ({overdueTasks.length})
            </button>
          )}
          <button
            onClick={() => { setCreateInitialDate(''); setShowCreate(true); setEditingTask(null); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Νέα Εργασία
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="animate-fade-in rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Νέα Εργασία</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <TaskForm
            tenantId={tenantId}
            initial={createInitialDate ? { due_date: createInitialDate } : undefined}
            saving={creating}
            error={createError}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      <EditTaskModal
        task={editingTask}
        tenantId={tenantId}
        saving={saving}
        error={saveError}
        onSubmit={handleUpdate}
        onClose={() => { setEditingTask(null); setSaveError(null); }}
      />

      <EditCallModal
        open={editingCall !== null}
        call={editingCall}
        onClose={() => setEditingCall(null)}
        onUpdated={() => { setEditingCall(null); load(year, month); }}
      />

      {/* Category filter */}
      <div className="animate-fade-in-up stagger-1 flex flex-wrap gap-1.5">
        <button
          onClick={() => { setShowOnlyCalls(false); setCategoryFilter(null); setAuthorityFilter(''); setGakFilter(''); setEakFilter(''); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!categoryFilter && !showOnlyCalls ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
        >
          Όλα
        </button>
        {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => { setShowOnlyCalls(false); setCategoryFilter(c => c === cat ? null : cat); setAuthorityFilter(''); setGakFilter(''); setEakFilter(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!showOnlyCalls && categoryFilter === cat ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
          >
            {TASK_CATEGORIES[cat]}
          </button>
        ))}
        <button
          onClick={() => { setShowOnlyCalls(v => !v); setCategoryFilter(null); setAuthorityFilter(''); setGakFilter(''); setEakFilter(''); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${showOnlyCalls ? 'bg-teal-500/15 text-teal-500' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'}`}
        >
          <Phone className="h-3 w-3" />
          Γεγονότα
        </button>
      </div>

      {(categoryFilter === 'legal_act' || categoryFilter === 'lawsuit') && (
        <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">{categoryFilter === 'lawsuit' ? 'Αρμόδιο Δικαστήριο' : 'Αρμόδια Αρχή'}</label>
            <input className="input w-full text-sm rounded-xl" placeholder="Φίλτρο…" value={authorityFilter} onChange={e => setAuthorityFilter(e.target.value)} />
          </div>
          {categoryFilter === 'lawsuit' && (<>
            <div>
              <label className="block text-xs text-text-secondary mb-1">ΓΑΚ</label>
              <input className="input w-full text-sm rounded-xl" placeholder="Φίλτρο…" value={gakFilter} onChange={e => setGakFilter(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">ΕΑΚ</label>
              <input className="input w-full text-sm rounded-xl" placeholder="Φίλτρο…" value={eakFilter} onChange={e => setEakFilter(e.target.value)} />
            </div>
          </>)}
        </div>
      )}

      {searchQuery.trim() ? (
        <div className="animate-fade-in-up stagger-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={searchYear ?? ''}
              onChange={e => setSearchYear(e.target.value ? Number(e.target.value) : null)}
              className="bg-secondary-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλα τα έτη</option>
              {Array.from({ length: todayDate.getFullYear() - 1999 }, (_, i) => 2000 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={searchMonth ?? ''}
              onChange={e => setSearchMonth(e.target.value !== '' ? Number(e.target.value) : null)}
              className="bg-secondary-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλοι οι μήνες</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
            {(searchYear !== null || searchMonth !== null) && (
              <button onClick={() => { setSearchYear(null); setSearchMonth(null); }} className="text-xs text-text-secondary hover:text-text-primary cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setSearchSortDesc(v => !v)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/15 bg-secondary-background text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              {searchSortDesc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              {searchSortDesc ? 'Νεότερα πρώτα' : 'Παλαιότερα πρώτα'}
            </button>
          </div>
          {searching ? (
            <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
              <RotateCcw className="h-4 w-4 animate-spin" />
              Αναζήτηση…
            </div>
          ) : (() => {
            const filtered = searchResults.filter(t => {
              if (categoryFilter && t.category !== categoryFilter) return false;
              if ((categoryFilter === 'legal_act' || categoryFilter === 'lawsuit') && t.extra_data) {
                const d = t.extra_data as LegalActData;
                if (authorityFilter && !d.authority?.toLowerCase().includes(authorityFilter.toLowerCase())) return false;
                if (gakFilter && !d.gak?.toLowerCase().includes(gakFilter.toLowerCase())) return false;
                if (eakFilter && !d.eak?.toLowerCase().includes(eakFilter.toLowerCase())) return false;
              }
              if (searchYear !== null && t.due_date) {
                const y = new Date(t.due_date + 'T00:00:00').getFullYear();
                if (y !== searchYear) return false;
              }
              if (searchMonth !== null && t.due_date) {
                const m = new Date(t.due_date + 'T00:00:00').getMonth();
                if (m !== searchMonth) return false;
              }
              return true;
            });
            const filteredCalls = searchCallResults.filter(c => {
              if (searchYear !== null) {
                const y = new Date(c.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).getFullYear();
                if (y !== searchYear) return false;
              }
              if (searchMonth !== null) {
                const m = new Date(c.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).getMonth();
                if (m !== searchMonth) return false;
              }
              return true;
            });
            const sortMul = searchSortDesc ? -1 : 1;
            filtered.sort((a, b) => sortMul * (a.due_date ?? '').localeCompare(b.due_date ?? ''));
            filteredCalls.sort((a, b) => sortMul * a.created_at.localeCompare(b.created_at));
            const total = filtered.length + filteredCalls.length;
            return total === 0 ? (
              <p className="text-sm text-text-secondary py-8 text-center">Δεν βρέθηκαν αποτελέσματα.</p>
            ) : (
              <>
                <p className="text-xs text-text-secondary">{total} αποτελέσματα</p>
                {filtered.map(task => (
                  <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                    onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                ))}
                {filteredCalls.map(call => (
                  <CallRow key={call.id} call={call} onNavigate={navigate} onEdit={setEditingCall}
                    onDelete={async (c) => { if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return; await deleteCall(c.id); load(year, month); }} />
                ))}
              </>
            );
          })()}
        </div>
      ) : loading ? (
        <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Φόρτωση εργασιών…
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 space-y-5">
        <div>
          <div className="min-w-0 rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {view === 'month' ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={month}
                    onChange={e => { setMonth(Number(e.target.value)); setSelectedDay(null); }}
                    className="bg-transparent text-sm font-semibold text-text-primary border-none outline-none cursor-pointer hover:text-primary transition-colors"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i} className="bg-secondary-background text-text-primary">{name}</option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={e => { setYear(Number(e.target.value)); setSelectedDay(null); }}
                    className="bg-transparent text-sm font-semibold text-text-primary border-none outline-none cursor-pointer hover:text-primary transition-colors"
                  >
                    {Array.from({ length: 41 }, (_, i) => todayDate.getFullYear() - 20 + i).map(y => (
                      <option key={y} value={y} className="bg-secondary-background text-text-primary">{y}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <h2 className="text-sm font-semibold text-text-primary">{headerTitle}</h2>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-xl border border-border/15 overflow-hidden text-xs">
                  {(['month', 'week', 'day'] as CalendarView[]).map(v => (
                    <button key={v} onClick={() => { setView(v); if (v !== 'month') setAnchor(selectedDay ?? todayStr); }}
                      className={`px-3 py-1.5 cursor-pointer transition-colors font-medium ${view === v ? 'bg-primary text-white' : 'text-text-secondary hover:bg-white/5'}`}>
                      {v === 'month' ? 'Μήνας' : v === 'week' ? 'Εβδομάδα' : 'Ημέρα'}
                    </button>
                  ))}
                </div>
                <button onClick={goToday} className="px-2 py-1 text-xs text-primary hover:underline cursor-pointer">Σήμερα</button>
                <button onClick={prevPeriod} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={nextPeriod} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Month view */}
            {view === 'month' && (<>
              <div className="grid grid-cols-7 gap-px">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-text-secondary uppercase tracking-wide py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const ds = dayStr(day);
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDay;
                  return (
                    <button key={ds} ref={el => { if (isToday) todayCellRef.current = el; if (isSelected) selectedCellRef.current = el; }} onClick={() => setSelectedDay(isSelected ? null : ds)}
                      className={['relative min-h-32 rounded-lg p-1.5 text-left transition-colors cursor-pointer flex flex-col gap-1 overflow-visible',
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white/4',
                        isToday ? 'ring-1 ring-primary/50' : ''].join(' ')}>
                      <span className={['text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                        isToday ? 'bg-primary text-white' : 'text-text-secondary'].join(' ')}>{day}</span>
                      <div className="flex flex-col gap-1 w-full">
                        {(dayItemsByDay.get(ds) ?? []).filter(entry => showOnlyCalls ? entry.type === 'call' : true).map(entry => {
                          if (entry.type === 'task') {
                            const task = entry.item;
                            const done = task.status === 'done';
                            const color = taskDueColor(task.due_date, todayStr, task.status);
                            const label = (task.case_code || task.category)
                              ? [task.case_code, task.category ? TASK_CATEGORIES[task.category] : null, task.client_name].filter(Boolean).join(' - ')
                              : task.title;
                            return (
                              <div key={task.id} className="relative group/chip w-full">
                                <span
                                  onClick={e => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }}
                                  className={['text-[14px] leading-snug px-2 py-1.5 rounded-md truncate w-full block cursor-pointer hover:brightness-125 transition-all',
                                    task.category === 'court' ? CATEGORY_COLORS['court'] :
                                    done ? 'bg-green-500/15 text-green-700 dark:text-green-400 opacity-75' :
                                    color ? DUE_COLOR_CHIP[color] :
                                    task.category ? CATEGORY_COLORS[task.category] : 'bg-primary/15 text-primary'].join(' ')}>
                                  {task.due_time && <span className="opacity-70 mr-1">{task.due_time.slice(0, 5)}</span>}{label}
                                </span>
                                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/chip:block w-72 rounded-xl border border-border/20 bg-secondary-background shadow-2xl p-3 space-y-2 pointer-events-none">
                                  <p className="text-sm font-semibold text-text-primary leading-snug">{task.title}</p>
                                  {task.case_code && <p className="text-xs text-primary font-mono">{task.case_code}{task.case_title ? ` — ${task.case_title}` : ''}</p>}
                                  {task.client_name && <p className="text-xs text-text-secondary">{task.client_name}</p>}
                                  {task.description && <p className="text-xs text-text-secondary leading-relaxed border-t border-border/10 pt-2">{task.description}</p>}
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/10 pt-2">
                                    {task.category && <span className="text-xs text-text-secondary">{TASK_CATEGORIES[task.category]}</span>}
                                    {task.due_date && <span className="text-xs text-text-secondary">{new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR')}{task.due_time ? ` ${task.due_time}` : ''}</span>}
                                    <span className={`text-xs font-semibold ${done ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'purple' ? 'text-purple-400' : color === 'orange' ? 'text-orange-400' : color === 'yellow' ? 'text-yellow-400' : 'text-text-secondary'}`}>
                                      {done ? 'Ολοκληρωμένη' : color === 'red' ? 'Ληξιπρόθεσμη' : 'Ανοιχτή'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            const call = entry.item;
                            const callTime = new Date(call.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const dirLabel = call.direction === 'phone' ? 'Τηλ' : call.direction === 'inperson' ? 'Αυτοπρ' : 'Email';
                            const chipText = call.case_code
                              ? `${call.case_code} · ${dirLabel}`
                              : `${dirLabel} · ${call.caller_name ?? call.phone ?? 'Άγνωστος'}`;
                            return (
                              <div key={call.id} className="relative group/callchip w-full">
                                <span
                                  onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}`); }}
                                  className={['text-[14px] leading-snug px-2 py-1.5 rounded-md truncate w-full block cursor-pointer hover:brightness-125 transition-all',
                                    call.follow_up_required && !call.follow_up_done ? 'bg-red-500/15 text-red-500' :
                                    call.direction === 'phone' ? 'bg-teal-500/10 text-teal-500' : 'bg-sky-500/10 text-sky-500'].join(' ')}>
                                  <span className="opacity-70 mr-1">{callTime}</span>{chipText}
                                </span>
                                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/callchip:block w-72 rounded-xl border border-border/20 bg-secondary-background shadow-2xl p-3 space-y-2 pointer-events-none">
                                  <p className="text-sm font-semibold text-text-primary leading-snug">{call.caller_name ?? call.phone ?? 'Άγνωστος'}</p>
                                  {call.phone && call.caller_name && <p className="text-xs text-text-secondary">{call.phone}</p>}
                                  {call.case_code && <p className="text-xs text-primary font-mono">{call.case_code}{call.case_title ? ` — ${call.case_title}` : ''}</p>}
                                  {call.description && <p className="text-xs text-text-secondary leading-relaxed border-t border-border/10 pt-2 line-clamp-3">{call.description}</p>}
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/10 pt-2">
                                    <span className="text-xs text-text-secondary">{call.direction === 'phone' ? 'Τηλέφωνο' : call.direction === 'inperson' ? 'Αυτοπρόσωπα' : 'Email'}</span>
                                    <span className="text-xs text-text-secondary">{callTime}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="border-t border-border/10 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {new Date(selectedDay + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setCreateInitialDate(selectedDay!); setShowCreate(true); setEditingTask(null); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Νέα Εργασία
                      </button>
                      <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {(showOnlyCalls ? [] : selectedTasks).length === 0 && (callsByDay.get(selectedDay!) ?? []).length === 0 ? (
                    <p className="text-sm text-text-secondary py-2">Δεν υπάρχουν εγγραφές αυτή την ημέρα.</p>
                  ) : (
                    <div className="space-y-2">
                      {!showOnlyCalls && selectedTasks.map(task => (
                        <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                          onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                      ))}
                      {(callsByDay.get(selectedDay!) ?? []).map(call => (
                        <CallRow key={call.id} call={call} onNavigate={navigate} onEdit={setEditingCall} onDelete={async (c) => { if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return; await deleteCall(c.id); load(year, month); }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>)}

            {/* Week view */}
            {view === 'week' && (<>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map(ds => {
                  const d = new Date(ds + 'T00:00:00');
                  const isToday = ds === todayStr;
                  const isSelected = ds === anchor;
                  return (
                    <div key={ds} onClick={() => setAnchor(ds)}
                      className={['rounded-lg p-2 flex flex-col gap-1 min-h-36 cursor-pointer transition-colors',
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white/4',
                        isToday ? 'ring-1 ring-primary/50' : ''].join(' ')}>
                      <div className="flex flex-col items-center pb-1 border-b border-border/10">
                        <span className="text-[10px] font-semibold text-text-secondary uppercase">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                        <span className={['text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full',
                          isToday ? 'bg-primary text-white' : 'text-text-primary'].join(' ')}>{d.getDate()}</span>
                      </div>
                      <div className="flex flex-col gap-1 overflow-hidden">
                        {(dayItemsByDay.get(ds) ?? []).filter(entry => showOnlyCalls ? entry.type === 'call' : true).map(entry => {
                          if (entry.type === 'task') {
                            const task = entry.item;
                            const done = task.status === 'done';
                            const color = taskDueColor(task.due_date, todayStr, task.status);
                            const label = (task.case_code || task.category)
                              ? [task.case_code, task.category ? TASK_CATEGORIES[task.category] : null, task.client_name].filter(Boolean).join(' - ')
                              : task.title;
                            return (
                              <span key={task.id}
                                onClick={e => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }}
                                className={['text-[11px] leading-snug px-2 py-1.5 rounded-md truncate block cursor-pointer hover:brightness-125 transition-all',
                                  task.category === 'court' ? CATEGORY_COLORS['court'] :
                                  done ? 'bg-green-500/15 text-green-700 dark:text-green-400 opacity-75' :
                                  color ? DUE_COLOR_CHIP[color] :
                                  task.category ? CATEGORY_COLORS[task.category] : 'bg-primary/15 text-primary'].join(' ')}>
                                {task.due_time && <span className="opacity-70 mr-1">{task.due_time.slice(0, 5)}</span>}{label}
                              </span>
                            );
                          } else {
                            const call = entry.item;
                            const callTime = new Date(call.created_at.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false });
                            const dirLabel = call.direction === 'phone' ? 'Τηλ' : call.direction === 'inperson' ? 'Αυτοπρ' : 'Email';
                            const chipText = call.case_code
                              ? `${call.case_code} · ${dirLabel}`
                              : `${dirLabel} · ${call.caller_name ?? call.phone ?? 'Άγνωστος'}`;
                            return (
                              <span key={call.id}
                                onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}`); }}
                                className={['text-[11px] leading-snug px-2 py-1.5 rounded-md truncate block cursor-pointer hover:brightness-125 transition-all',
                                  call.follow_up_required && !call.follow_up_done ? 'bg-red-500/15 text-red-500' :
                                  call.direction === 'phone' ? 'bg-teal-500/10 text-teal-500' : 'bg-sky-500/10 text-sky-500'].join(' ')}>
                                <span className="opacity-70 mr-1">{callTime}</span>{chipText}
                              </span>
                            );
                          }
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/10 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {new Date(anchor + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => { setCreateInitialDate(anchor); setShowCreate(true); setEditingTask(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Νέα Εργασία
                  </button>
                </div>
                {(showOnlyCalls ? 0 : (tasksByDay.get(anchor) ?? []).length) === 0 && (callsByDay.get(anchor) ?? []).length === 0 ? (
                  <p className="text-sm text-text-secondary py-2">Δεν υπάρχουν εγγραφές αυτή την ημέρα.</p>
                ) : (
                  <div className="space-y-2">
                    {!showOnlyCalls && (tasksByDay.get(anchor) ?? []).map(task => (
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                        onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                    ))}
                    {(callsByDay.get(anchor) ?? []).map(call => (
                      <CallRow key={call.id} call={call} onNavigate={navigate} onEdit={setEditingCall} onDelete={async (c) => { if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return; await deleteCall(c.id); load(year, month); }} />
                    ))}
                  </div>
                )}
              </div>
            </>)}

            {/* Day view */}
            {view === 'day' && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={() => { setCreateInitialDate(anchor); setShowCreate(true); setEditingTask(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Νέα Εργασία
                  </button>
                </div>
                {(showOnlyCalls ? 0 : (tasksByDay.get(anchor) ?? []).length) === 0 && (callsByDay.get(anchor) ?? []).length === 0 ? (
                  <p className="text-sm text-text-secondary py-2">Δεν υπάρχουν εγγραφές αυτή την ημέρα.</p>
                ) : (
                  <div className="space-y-2">
                    {!showOnlyCalls && (tasksByDay.get(anchor) ?? []).map(task => (
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                        onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                    ))}
                    {(callsByDay.get(anchor) ?? []).map(call => (
                      <CallRow key={call.id} call={call} onNavigate={navigate} onEdit={setEditingCall} onDelete={async (c) => { if (!confirm('Διαγραφή γεγονότος; Η ενέργεια δεν αναιρείται.')) return; await deleteCall(c.id); load(year, month); }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

          {noDueDateTasks.length > 0 && (
            <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
                <h2 className="text-sm font-semibold text-orange-400">Χωρίς προθεσμία ({noDueDateTasks.length})</h2>
              </div>
              <div className="space-y-2">
                {noDueDateTasks.map(task => (
                  <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling}
                    onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit task modal ───────────────────────────────────────────────────────────

function EditTaskModal({ task, tenantId, saving, error, onSubmit, onClose }: {
  task: Task | null;
  tenantId: string;
  saving: boolean;
  error: string | null;
  onSubmit: (v: TaskFormValues) => void;
  onClose: () => void;
}) {
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-secondary-background px-6 py-4 border-b border-border/10">
          <h2 className="text-sm font-semibold text-text-primary">Επεξεργασία Εργασίας</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <TaskForm
            key={task.id}
            tenantId={tenantId}
            initial={{ ...taskToFormValues(task), id: task.id, case_code: task.case_code ?? undefined, case_title: task.case_title ?? undefined }}
            saving={saving}
            error={error}
            onSubmit={onSubmit}
            onCancel={onClose}
            submitLabel="Αποθήκευση"
          />
        </div>
      </div>
    </div>
  );
}

// ── Call row ──────────────────────────────────────────────────────────────────

function CallRow({ call, onNavigate, onEdit, onDelete }: {
  call: Call;
  onNavigate: ReturnType<typeof useNavigate>;
  onEdit: (c: Call) => void;
  onDelete: (c: Call) => void;
}) {
  const isPhone = call.direction === 'phone';
  const needsFollowUp = call.follow_up_required && !call.follow_up_done;
  return (
    <div className={`rounded-xl border px-4 py-3 space-y-1 group ${needsFollowUp ? 'border-red-500/20 bg-red-500/5' : isPhone ? 'border-teal-500/20 bg-teal-500/5' : 'border-sky-500/20 bg-sky-500/5'}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${needsFollowUp ? 'bg-red-500/10 text-red-500' : isPhone ? 'bg-teal-500/10 text-teal-500' : 'bg-sky-500/10 text-sky-500'}`}>
          {isPhone ? <Phone className="h-3.5 w-3.5" /> : call.direction === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{call.caller_name ?? call.phone ?? 'Άγνωστος'}</p>
          {call.phone && call.caller_name && <p className="text-xs text-text-secondary">{call.phone}</p>}
          {call.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{call.description}</p>}
          {call.case_code && (
            <button onClick={() => call.case_id && onNavigate(`/cases/${call.case_id}`)}
              className="text-xs text-primary hover:underline cursor-pointer mt-0.5 font-mono">
              {call.case_code} — {call.case_title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${needsFollowUp ? 'bg-red-500/15 text-red-500' : isPhone ? 'bg-teal-500/15 text-teal-500' : 'bg-sky-500/15 text-sky-500'}`}>
            {needsFollowUp ? 'Follow-up' : isPhone ? 'Τηλέφωνο' : call.direction === 'email' ? 'Email' : 'Αυτοπρόσωπα'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onEdit(call)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
              title="Επεξεργασία"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(call)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer transition-colors"
              title="Διαγραφή"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, todayStr, toggling, onToggle, onEdit, onDelete, onNavigate }: {
  task: Task;
  todayStr: string;
  toggling: string | null;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onNavigate: ReturnType<typeof useNavigate>;
}) {
  const done = task.status === 'done';
  const color = taskDueColor(task.due_date, todayStr, task.status);

  const totalExpenses = task.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const hasFinancials = task.fee != null || (task.expenses?.length ?? 0) > 0;

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${task.category === 'court' ? 'border-rose-500/40 bg-rose-500/8' : color ? DUE_COLOR_CARD[color] : done ? 'border-green-600/20 bg-green-500/8 opacity-80' : 'border-border/10 bg-white/2'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task)}
          disabled={toggling === task.id}
          className={['mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
            done ? 'border-green-500 bg-green-500 text-white' :
            color ? DUE_COLOR_BTN[color] :
            'border-border/30 hover:border-primary'].join(' ')}
        >
          {done && <Check className="h-3 w-3" />}
          {!done && toggling === task.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onNavigate(`/tasks/${task.id}`)} className="text-left hover:underline cursor-pointer">
            <p className={`text-sm font-medium ${done ? 'text-text-secondary' : 'text-text-primary'}`}>
              {(task.case_code || task.category)
                ? [task.case_code, task.category ? TASK_CATEGORIES[task.category] : null].filter(Boolean).join(' · ')
                : task.title}
            </p>
            {(task.case_code || task.category) && (
              <p className={`text-xs ${done ? 'text-text-secondary/60' : 'text-text-secondary'}`}>{task.title}</p>
            )}
          </button>
          <ExtraDataSummary task={task} />
          {task.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{task.description}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {task.case_code && (
              <button onClick={() => task.case_id && onNavigate(`/cases/${task.case_id}`)}
                className="text-xs text-primary hover:underline cursor-pointer font-mono">
                {task.case_code} — {task.case_title}
              </button>
            )}
            {task.category && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[task.category]}`}>
                {TASK_CATEGORIES[task.category]}
              </span>
            )}
            {(task.linked_tasks?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/8 text-text-secondary">
                <Link2 className="h-2.5 w-2.5" />
                {task.linked_tasks!.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.due_date && (
            <span className={`text-[14px] font-medium px-1.5 py-0.5 rounded ${color ? DUE_COLOR_CHIP[color] : done ? 'text-text-secondary' : 'bg-white/8 text-text-secondary'}`}>
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              {task.due_time && <span className="ml-1 opacity-80">{task.due_time}</span>}
            </span>
          )}
          {color && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${DUE_COLOR_CHIP[color]}`}>
              <AlertCircle className="h-2.5 w-2.5" />
              {color === 'red' ? 'Ληξ/θεσμη' : color === 'purple' ? '≤7 ημ.' : color === 'orange' ? '≤20 ημ.' : '≤30 ημ.'}
            </span>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {hasFinancials && (
        <div className="flex flex-wrap gap-3 pl-8 text-xs text-green-500">
          {task.fee != null && task.fee > 0 && (
            <span>Αμοιβή: <strong>{task.fee.toFixed(2)} €</strong></span>
          )}
          {(task.expenses?.length ?? 0) > 0 && (
            <span className="text-red-500">Έξοδα: <strong>{totalExpenses.toFixed(2)} €</strong> ({task.expenses!.length})</span>
          )}
        </div>
      )}
    </div>
  );
}

function ExtraDataSummary({ task }: { task: Task }) {
  const lines: React.ReactNode[] = [];

  if (task.category && task.extra_data) {
    if (task.category === 'legal_act' || task.category === 'lawsuit') {
      const d = task.extra_data as LegalActData;
      const parts = [
        d.authority && `${task.category === 'lawsuit' ? 'Δικαστήριο' : 'Αρχή'}: ${d.authority}`,
        task.category === 'lawsuit' && d.gak && `ΓΑΚ: ${d.gak}`,
        task.category === 'lawsuit' && d.eak && `ΕΑΚ: ${d.eak}`,
        task.category === 'legal_act' && d.protocol_number && `Αρ. Πρωτ.: ${d.protocol_number}`,
      ].filter(Boolean);
      if (parts.length) lines.push(<span key="legal">{parts.join(' · ')}</span>);
    } else if (task.category === 'appointment') {
      const d = task.extra_data as AppointmentData;
      if (d.start_datetime) {
        const start = new Date(d.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const end = d.end_datetime ? ' – ' + new Date(d.end_datetime).toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '';
        lines.push(<span key="appt">{start}{end}</span>);
      }
    } else if (task.category === 'court') {
      const d = task.extra_data as CourtData;
      const parts = [
        d.decision_number && `Αρ. Απόφασης: ${d.decision_number}`,
        d.decision_date && `Ημ. Έκδοσης: ${new Date(d.decision_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
      ].filter(Boolean);
      if (parts.length) lines.push(<span key="court">{parts.join(' · ')}</span>);
    }
  }

  if (!lines.length) return null;
  return <div className="text-xs text-text-secondary mt-0.5 space-y-0.5">{lines}</div>;
}
