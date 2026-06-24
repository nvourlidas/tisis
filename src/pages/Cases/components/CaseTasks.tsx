import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, RotateCcw, X, ChevronLeft, ChevronRight, Pencil, Search, Trash2, List, CalendarDays, Clock, Link2 } from 'lucide-react';
import { fetchCaseTasks, completeTask, reopenTask } from '../caseUtils';
import { updateTask, deleteTask, fetchCategoryRates, calcTaskAmount, TASK_CATEGORIES, searchFullTasks, type Task, type TaskCategory, type CategoryRate, type LegalActData, type AppointmentData } from '../../Tasks/taskUtils';
import { supabase } from '../../../lib/supabase';
import { formatDate } from '../../../lib/dateUtils';
import TaskForm, { type TaskFormValues } from '../../Tasks/TaskForm';
import type { CaseTask } from '../types';

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
  red:    'bg-red-500/15 text-red-500',
  purple: 'bg-purple-500/15 text-purple-500',
  orange: 'bg-orange-500/15 text-orange-500',
  yellow: 'bg-yellow-500/15 text-yellow-500',
};

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  legal_act:    'bg-blue-500/15 text-blue-500',
  lawsuit:      'bg-orange-500/15 text-orange-500',
  extrajudicial:'bg-purple-500/15 text-purple-500',
  appointment:  'bg-teal-500/15 text-teal-500',
  file_work:    'bg-amber-500/15 text-amber-500',
  court:        'bg-rose-600 text-white font-semibold',
};

type Props = { caseId: string; tenantId?: string; caseCode?: string; clientName?: string };

export default function CaseTasks({ caseId, tenantId = '', caseCode, clientName }: Props) {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr + 'T00:00:00');

  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<CaseTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [rates, setRates] = useState<CategoryRate[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linking, setLinking] = useState(false);

  const [displayMode, setDisplayMode] = useState<'list' | 'calendar'>('list');
  const [view, setView] = useState<CalendarView>('month');
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [anchor, setAnchor] = useState<string>(todayStr);

  const load = () => {
    setLoading(true);
    fetchCaseTasks(caseId).then(setTasks).finally(() => setLoading(false));
  };

  const doDeleteTask = async (t: CaseTask) => {
    if (!confirm('Διαγραφή εργασίας; Η ενέργεια δεν αναιρείται.')) return;
    await deleteTask(t.id);
    load();
  };

  useEffect(() => { load(); }, [caseId]);
  useEffect(() => { if (tenantId) fetchCategoryRates(tenantId).then(setRates).catch(() => {}); }, [tenantId]);

  const toggle = async (task: CaseTask) => {
    setToggling(task.id);
    try {
      if (task.status === 'open') await completeTask(task.id);
      else await reopenTask(task.id);
      load();
    } finally {
      setToggling(null);
    }
  };

  const handleCreate = async (values: TaskFormValues) => {
    setCreating(true);
    setCreateError(null);
    try {
      const { error } = await supabase.functions.invoke('task-create', {
        body: {
          case_id: caseId,
          title: values.title,
          description: values.description,
          due_date: values.due_date,
          category: values.category || null,
          extra_data: values.extra_data,
          hours: values.hours,
        },
      });
      if (error) throw error;
      setShowForm(false);
      load();
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
        case_id: values.case_id || caseId,
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
      });
      setEditingTask(null);
      load();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkTask = async (task: Task) => {
    setLinking(true);
    try {
      const { error } = await supabase.from('tasks').update({ case_id: caseId }).eq('id', task.id);
      if (error) throw error;
      setShowLinkModal(false);
      load();
    } finally {
      setLinking(false);
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
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter(t => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, categoryFilter, searchQuery]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CaseTask[]>();
    for (const t of filteredTasks) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.category === 'court' && b.category !== 'court') return -1;
        if (b.category === 'court' && a.category !== 'court') return 1;
        return (a.due_time ?? '99:99').localeCompare(b.due_time ?? '99:99');
      });
    }
    return map;
  }, [filteredTasks]);

  const noDueDateTasks = useMemo(() => filteredTasks.filter(t => !t.due_date && t.status === 'open'), [filteredTasks]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dayStr = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = i - startDow + 1;
    cells.push(d >= 1 && d <= daysInMonth ? d : null);
  }

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

  const open = filteredTasks.filter(t => t.status === 'open');
  const done = filteredTasks.filter(t => t.status === 'done');

  const caseTaskToFormValues = (t: CaseTask): TaskFormValues => ({
    title: t.title,
    description: t.description ?? '',
    due_date: t.due_date ?? '',
    due_time: t.due_time ?? '',
    case_id: '',
    category: t.category ?? '',
    extra_data: t.extra_data ?? null,
    hours: t.hours ?? null,
    linked_task_ids: [],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{open.length} ανοιχτές</span>
          {done.length > 0 && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">{done.length} ολοκληρωμένες</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/15 overflow-hidden text-xs">
            <button onClick={() => setDisplayMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-colors ${displayMode === 'list' ? 'bg-primary/20 text-primary font-semibold' : 'text-text-secondary hover:bg-white/5'}`}>
              <List className="h-3.5 w-3.5" />
              Λίστα
            </button>
            <button onClick={() => setDisplayMode('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-colors ${displayMode === 'calendar' ? 'bg-primary/20 text-primary font-semibold' : 'text-text-secondary hover:bg-white/5'}`}>
              <CalendarDays className="h-3.5 w-3.5" />
              Ημερολόγιο
            </button>
          </div>
          <div className="flex items-center gap-2 h-9 w-52 rounded-xl border border-border/10 bg-secondary-background px-3">
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
          <button onClick={() => setShowLinkModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
            <Link2 className="h-3.5 w-3.5" />
            Σύνδεση Εργασίας
          </button>
          <button onClick={() => { setShowForm(v => !v); setEditingTask(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            Νέα Εργασία
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Νέα Εργασία</h3>
            <button type="button" onClick={() => { setShowForm(false); setCreateError(null); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <TaskForm
            tenantId=""
            hideCaseField
            initial={{ case_code: caseCode, case_client_name: clientName }}
            saving={creating}
            error={createError}
            onSubmit={handleCreate}
            onCancel={() => { setShowForm(false); setCreateError(null); }}
          />
        </div>
      )}

      <EditTaskModal
        task={editingTask}
        saving={saving}
        error={saveError}
        initialValues={editingTask ? caseTaskToFormValues(editingTask) : undefined}
        onSubmit={handleUpdate}
        onClose={() => { setEditingTask(null); setSaveError(null); }}
      />

      {showLinkModal && (
        <LinkTaskModal
          tenantId={tenantId}
          alreadyLinked={tasks.map(t => t.id)}
          linking={linking}
          onSelect={handleLinkTask}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!categoryFilter ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
          Όλες
        </button>
        {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(c => c === cat ? null : cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${categoryFilter === cat ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
            {TASK_CATEGORIES[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες για αυτή την υπόθεση.</p>
      ) : displayMode === 'list' ? (
        <TaskListView
          tasks={filteredTasks}
          todayStr={todayStr}
          toggling={toggling}
          rates={rates}
          onToggle={toggle}
          onEdit={setEditingTask}
          onDelete={doDeleteTask}
          onNavigate={navigate}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-text-primary">{headerTitle}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-border/15 overflow-hidden text-xs">
                  {(['month', 'week', 'day'] as CalendarView[]).map(v => (
                    <button key={v} onClick={() => { setView(v); if (v !== 'month') setAnchor(selectedDay ?? todayStr); }}
                      className={`px-2.5 py-1 cursor-pointer transition-colors ${view === v ? 'bg-primary/20 text-primary font-semibold' : 'text-text-secondary hover:bg-white/5'}`}>
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
                  const dayTasks = tasksByDay.get(ds) ?? [];
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDay;
                  return (
                    <button key={ds} onClick={() => setSelectedDay(isSelected ? null : ds)}
                      className={['relative min-h-16 rounded-lg p-1.5 text-left transition-colors cursor-pointer flex flex-col gap-1',
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white/4',
                        isToday ? 'ring-1 ring-primary/50' : ''].join(' ')}>
                      <span className={['text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                        isToday ? 'bg-primary text-white' : 'text-text-secondary'].join(' ')}>{day}</span>
                      <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                        {dayTasks.slice(0, 3).map(task => {
                          const overdue = task.status === 'open' && ds < todayStr;
                          const done = task.status === 'done';
                          return (
                            <span key={task.id} className={['text-xs leading-tight px-1.5 py-0.5 rounded truncate w-full',
                              task.category === 'court' ? CATEGORY_COLORS['court'] :
                              done ? 'bg-green-500/10 text-green-400 opacity-60' :
                              overdue ? 'bg-orange-500/15 text-orange-400' :
                              task.category ? CATEGORY_COLORS[task.category] : 'bg-primary/15 text-primary'].join(' ')}>
                              {task.title}
                            </span>
                          );
                        })}
                        {dayTasks.length > 3 && <span className="text-xs text-text-secondary px-1">+{dayTasks.length - 3} ακόμα</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="border-t border-border/10 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {new Date(selectedDay + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h4>
                    <button onClick={() => setSelectedDay(null)} className="p-1 rounded hover:bg-white/5 text-text-secondary cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {selectedTasks.length === 0 ? (
                    <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες αυτή την ημέρα.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTasks.map(task => (
                        <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} rates={rates} onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
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
                  const dayTasks = tasksByDay.get(ds) ?? [];
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
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dayTasks.map(task => {
                          const overdue = task.status === 'open' && ds < todayStr;
                          const done = task.status === 'done';
                          return (
                            <span key={task.id} className={['text-xs leading-tight px-1.5 py-0.5 rounded truncate block',
                              task.category === 'court' ? CATEGORY_COLORS['court'] :
                              done ? 'bg-green-500/10 text-green-400 opacity-60' :
                              overdue ? 'bg-orange-500/15 text-orange-400' :
                              task.category ? CATEGORY_COLORS[task.category] : 'bg-primary/15 text-primary'].join(' ')}>
                              {task.title}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border/10 pt-3 space-y-2">
                <h4 className="text-sm font-semibold text-text-primary">
                  {new Date(anchor + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h4>
                {(tasksByDay.get(anchor) ?? []).length === 0 ? (
                  <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες αυτή την ημέρα.</p>
                ) : (
                  <div className="space-y-2">
                    {(tasksByDay.get(anchor) ?? []).map(task => (
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} rates={rates} onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </>)}

            {/* Day view */}
            {view === 'day' && (
              <div className="space-y-2">
                {(tasksByDay.get(anchor) ?? []).length === 0 ? (
                  <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες αυτή την ημέρα.</p>
                ) : (
                  <div className="space-y-2">
                    {(tasksByDay.get(anchor) ?? []).map(task => (
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} rates={rates} onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {noDueDateTasks.length > 0 && (
            <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary">Χωρίς προθεσμία ({noDueDateTasks.length})</h3>
              <div className="space-y-2">
                {noDueDateTasks.map(task => (
                  <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} rates={rates} onToggle={toggle} onEdit={setEditingTask} onDelete={doDeleteTask} onNavigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task list view ────────────────────────────────────────────────────────────

function TaskListView({ tasks, todayStr, toggling, rates, onToggle, onEdit, onDelete, onNavigate }: {
  tasks: CaseTask[];
  todayStr: string;
  toggling: string | null;
  rates: CategoryRate[];
  onToggle: (t: CaseTask) => void;
  onEdit: (t: CaseTask) => void;
  onDelete: (t: CaseTask) => void;
  onNavigate: (path: string) => void;
}) {
  const overdue = tasks.filter(t => t.status === 'open' && !!t.due_date && t.due_date < todayStr);
  const today   = tasks.filter(t => t.status === 'open' && t.due_date === todayStr);
  const upcoming = tasks.filter(t => t.status === 'open' && !!t.due_date && t.due_date > todayStr);
  const noDue   = tasks.filter(t => t.status === 'open' && !t.due_date);
  const done    = tasks.filter(t => t.status === 'done');

  if (tasks.length === 0) return <p className="text-sm text-text-secondary py-4 text-center">Δεν βρέθηκαν εργασίες.</p>;

  const Group = ({ label, items, accent }: { label: string; items: CaseTask[]; accent?: string }) => {
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${accent ?? 'text-text-secondary'}`}>{label} ({items.length})</h4>
        {items.map(t => (
          <TaskRow key={t.id} task={t} todayStr={todayStr} toggling={toggling} rates={rates} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onNavigate={onNavigate} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Group label="Ληξιπρόθεσμες" items={overdue} accent="text-orange-400" />
      <Group label="Σήμερα" items={today} accent="text-primary" />
      <Group label="Επερχόμενες" items={upcoming} />
      <Group label="Χωρίς προθεσμία" items={noDue} />
      <Group label="Ολοκληρωμένες" items={done} accent="text-green-500" />
    </div>
  );
}

// ── Edit task modal ───────────────────────────────────────────────────────────

function EditTaskModal({ task, saving, error, initialValues, onSubmit, onClose }: {
  task: CaseTask | null;
  saving: boolean;
  error: string | null;
  initialValues?: TaskFormValues;
  onSubmit: (v: TaskFormValues) => void;
  onClose: () => void;
}) {
  if (!task || !initialValues) return null;
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
            tenantId=""
            hideCaseField
            initial={initialValues}
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

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, todayStr, toggling, rates, onToggle, onEdit, onDelete, onNavigate }: {
  task: CaseTask;
  todayStr: string;
  toggling: string | null;
  rates: CategoryRate[];
  onToggle: (t: CaseTask) => void;
  onEdit: (t: CaseTask) => void;
  onDelete: (t: CaseTask) => void;
  onNavigate: (path: string) => void;
}) {
  const overdue = task.status === 'open' && !!task.due_date && task.due_date < todayStr;
  const done = task.status === 'done';
  const dueColor = taskDueColor(task.due_date, todayStr, task.status);

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${task.category === 'court' ? 'border-rose-500/40 bg-rose-500/8' : overdue ? 'border-orange-500/20 bg-orange-500/5' : done ? 'border-green-500/20 bg-green-500/5 opacity-70' : 'border-border/10 bg-white/2'}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(task)} disabled={toggling === task.id}
          className={['mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
            done ? 'border-green-500 bg-green-500 text-white' :
            overdue ? 'border-orange-400 hover:bg-orange-400/20' :
            'border-border/30 hover:border-primary'].join(' ')}>
          {done && <Check className="h-3 w-3" />}
          {!done && toggling === task.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => onNavigate(`/tasks/${task.id}`)} className="text-left hover:underline cursor-pointer">
            <p className={`text-sm font-medium ${done ? 'text-text-secondary' : 'text-text-primary'}`}>{task.title}</p>
          </button>
          {task.description && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{task.description}</p>}
          <ExtraDataSummary task={task} />
          {task.category && (
            <div className="mt-1">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[task.category]}`}>
                {TASK_CATEGORIES[task.category]}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.hours != null && task.hours > 0 && (() => {
            const amt = calcTaskAmount(task.hours, rates, task.category);
            return (
              <div className="flex flex-col items-end gap-0.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/15">
                <div className="flex items-center gap-1 text-blue-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{task.hours}ω</span>
                </div>
                {amt != null && (
                  <span className="text-xs font-medium text-blue-300">
                    {new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amt)}
                  </span>
                )}
              </div>
            );
          })()}
          {task.due_date && (
            <span className={`text-[14px] font-medium px-2 py-1 rounded-lg ${dueColor ? DUE_COLOR_CHIP[dueColor] : done ? 'text-text-secondary' : 'bg-white/8 text-text-secondary'}`}>
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          )}
          <button onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(task)}
            className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtraDataSummary({ task }: { task: CaseTask }) {
  const lines: React.ReactNode[] = [];

  if (task.category && task.extra_data) {
    if (task.category === 'legal_act') {
      const d = task.extra_data as LegalActData;
      const parts = [
        d.authority && `Αρχή: ${d.authority}`,
        d.gak && `ΓΑΚ: ${d.gak}`,
        d.eak && `ΕΑΚ: ${d.eak}`,
        d.protocol_number && `Αρ. Πρωτ.: ${d.protocol_number}`,
      ].filter(Boolean);
      if (parts.length) lines.push(<span key="legal">{parts.join(' · ')}</span>);
    } else if (task.category === 'appointment') {
      const d = task.extra_data as AppointmentData;
      if (d.start_datetime) {
        const start = new Date(d.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const end = d.end_datetime ? ' – ' + new Date(d.end_datetime).toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit' }) : '';
        lines.push(<span key="appt">{start}{end}</span>);
      }
    }
  }

  if (!lines.length) return null;
  return <div className="text-xs text-text-secondary mt-0.5 space-y-0.5">{lines}</div>;
}

// ── Link task modal ───────────────────────────────────────────────────────────

const MODAL_MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

function LinkTaskModal({ tenantId, alreadyLinked, linking, onSelect, onClose }: {
  tenantId: string;
  alreadyLinked: string[];
  linking: boolean;
  onSelect: (task: Task) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Task[]>([]);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<TaskCategory | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!query.trim() || !tenantId) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const all = await searchFullTasks(tenantId, query.trim());
        setResults(all);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const filtered = results.filter(t => {
    if (alreadyLinked.includes(t.id)) return false;
    if (t.case_id) return false;
    if (category && t.category !== category) return false;
    if (filterYear !== null && t.due_date) {
      if (new Date(t.due_date + 'T00:00:00').getFullYear() !== filterYear) return false;
    }
    if (filterMonth !== null && t.due_date) {
      if (new Date(t.due_date + 'T00:00:00').getMonth() !== filterMonth) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/10 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Σύνδεση Υπάρχουσας Εργασίας
          </h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-3 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-border/15 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Αναζήτηση εργασίας…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
            {searching && <RotateCcw className="h-3.5 w-3.5 animate-spin text-text-secondary shrink-0" />}
            {query && !searching && (
              <button onClick={() => setQuery('')} className="text-text-secondary hover:text-text-primary cursor-pointer shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={category ?? ''}
              onChange={e => setCategory(e.target.value ? e.target.value as TaskCategory : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλες οι κατηγορίες</option>
              {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map(c => (
                <option key={c} value={c}>{TASK_CATEGORIES[c]}</option>
              ))}
            </select>
            <select
              value={filterYear ?? ''}
              onChange={e => setFilterYear(e.target.value ? Number(e.target.value) : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλα τα έτη</option>
              {Array.from({ length: currentYear - 1999 }, (_, i) => 2000 + i).reverse().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterMonth ?? ''}
              onChange={e => setFilterMonth(e.target.value !== '' ? Number(e.target.value) : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλοι οι μήνες</option>
              {MODAL_MONTH_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {!query.trim() ? (
            <p className="text-sm text-text-secondary text-center py-8">Πληκτρολογήστε για αναζήτηση.</p>
          ) : filtered.length === 0 && !searching ? (
            <p className="text-sm text-text-secondary text-center py-8">Δεν βρέθηκαν εργασίες.</p>
          ) : (
            filtered.map(t => {
              const today = new Date().toISOString().slice(0, 10);
              const isOverdue = t.status === 'open' && !!t.due_date && t.due_date < today;
              const isDone = t.status === 'done';
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  disabled={linking}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/10 bg-white/2 hover:bg-white/6 hover:border-primary/20 px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-60"
                >
                  <div className={[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    isDone ? 'border-green-500 bg-green-500 text-white' :
                    isOverdue ? 'border-orange-400' : 'border-border/40',
                  ].join(' ')}>
                    {isDone && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDone ? 'text-text-secondary' : 'text-text-primary'}`}>
                      {t.title}
                    </p>
                    {t.case_code && (
                      <p className="text-xs text-primary font-mono truncate">{t.case_code}{t.case_title ? ` — ${t.case_title}` : ''}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {t.category && (
                      <span className="text-[10px] text-text-secondary">{TASK_CATEGORIES[t.category]}</span>
                    )}
                    {t.due_date && (
                      <span className={`text-[10px] ${isOverdue ? 'text-orange-400' : 'text-text-secondary'}`}>
                        {formatDate(t.due_date)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
