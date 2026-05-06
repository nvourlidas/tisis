import { useEffect, useState, useMemo } from 'react';
import { Plus, Check, RotateCcw, X, AlertCircle, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { fetchCaseTasks, completeTask, reopenTask } from '../caseUtils';
import { updateTask, TASK_CATEGORIES, type TaskCategory, type LegalActData, type AppointmentData, type TaskExpense } from '../../Tasks/taskUtils';
import { supabase } from '../../../lib/supabase';
import TaskForm, { type TaskFormValues, taskToFormValues } from '../../Tasks/TaskForm';
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

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  legal_act:    'bg-blue-500/15 text-blue-500',
  extrajudicial:'bg-purple-500/15 text-purple-500',
  appointment:  'bg-teal-500/15 text-teal-500',
  file_work:    'bg-amber-500/15 text-amber-500',
};

type Props = { caseId: string; tenantId?: string };

export default function CaseTasks({ caseId }: Props) {
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

  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | null>(null);

  const [view, setView] = useState<CalendarView>('month');
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [anchor, setAnchor] = useState<string>(todayStr);

  const load = () => {
    setLoading(true);
    fetchCaseTasks(caseId).then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

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
          fee: values.fee,
          expenses: values.expenses,
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
        category: values.category || undefined,
        extra_data: values.extra_data,
        fee: values.fee,
        expenses: values.expenses,
      });
      setEditingTask(null);
      load();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
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

  const filteredTasks = useMemo(() =>
    categoryFilter ? tasks.filter(t => t.category === categoryFilter) : tasks,
    [tasks, categoryFilter]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CaseTask[]>();
    for (const t of filteredTasks) {
      if (!t.due_date) continue;
      if (!map.has(t.due_date)) map.set(t.due_date, []);
      map.get(t.due_date)!.push(t);
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
    case_id: '',
    category: t.category ?? '',
    extra_data: t.extra_data ?? null,
    fee: t.fee ?? null,
    expenses: t.expenses ?? [],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{open.length} ανοιχτές</span>
          {done.length > 0 && <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">{done.length} ολοκληρωμένες</span>}
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingTask(null); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
          <Plus className="h-3.5 w-3.5" />
          Νέα Εργασία
        </button>
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
                              done ? 'bg-green-500/10 text-green-400 line-through opacity-60' :
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
                        <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} onToggle={toggle} onEdit={setEditingTask} />
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
                              done ? 'bg-green-500/10 text-green-400 line-through opacity-60' :
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
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} onToggle={toggle} onEdit={setEditingTask} />
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
                      <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} onToggle={toggle} onEdit={setEditingTask} />
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
                  <TaskRow key={task.id} task={task} todayStr={todayStr} toggling={toggling} onToggle={toggle} onEdit={setEditingTask} />
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

function TaskRow({ task, todayStr, toggling, onToggle, onEdit }: {
  task: CaseTask;
  todayStr: string;
  toggling: string | null;
  onToggle: (t: CaseTask) => void;
  onEdit: (t: CaseTask) => void;
}) {
  const overdue = task.status === 'open' && !!task.due_date && task.due_date < todayStr;
  const done = task.status === 'done';

  const totalExpenses = task.expenses?.reduce((s, e) => s + (e as TaskExpense).amount, 0) ?? 0;
  const hasFinancials = task.fee != null || (task.expenses?.length ?? 0) > 0;

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${overdue ? 'border-orange-500/20 bg-orange-500/5' : done ? 'border-green-500/20 bg-green-500/5 opacity-70' : 'border-border/10 bg-white/2'}`}>
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
          <p className={`text-sm font-medium ${done ? 'line-through text-text-secondary' : 'text-text-primary'}`}>{task.title}</p>
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
        <div className="flex items-center gap-1 shrink-0">
          {overdue && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/15 text-orange-400">
              <AlertCircle className="h-2.5 w-2.5" />
              Ληξ/θεσμη
            </span>
          )}
          <button onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {hasFinancials && (
        <div className="flex flex-wrap gap-3 pl-8 text-xs text-green-400">
          {task.fee != null && task.fee > 0 && (
            <span>Αμοιβή: <strong>{task.fee.toFixed(2)} €</strong></span>
          )}
          {(task.expenses?.length ?? 0) > 0 && (
            <span className="text-red-400">Έξοδα: <strong>{totalExpenses.toFixed(2)} €</strong> ({task.expenses!.length})</span>
          )}
        </div>
      )}
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
        d.eka && `ΕΚΑ: ${d.eka}`,
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
