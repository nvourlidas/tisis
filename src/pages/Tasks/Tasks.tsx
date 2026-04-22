import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Plus, Check, RotateCcw, AlertCircle, Search, X } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchAllTasks, completeTask, reopenTask, createTask, groupTasks } from './taskUtils';
import { searchCasesForCall } from '../Calls/callUtils';
import type { Task } from './taskUtils';

export default function Tasks() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchAllTasks(tenantId).then(setTasks).finally(() => setLoading(false));
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

  const groups = groupTasks(tasks);
  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.noDueDate.length;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Εργασίες</h1>
          {!loading && (
            <p className="text-sm text-text-secondary mt-0.5">
              {openCount} ανοιχτές · {groups.done.length} ολοκληρωμένες
            </p>
          )}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" />
          Νέα Εργασία
        </button>
      </div>

      {showCreate && (
        <NewTaskForm
          tenantId={tenantId}
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : openCount === 0 && groups.done.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <CheckSquare className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Δεν υπάρχουν εργασίες ακόμα.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <TaskGroup
            label="Ληξιπρόθεσμες"
            tasks={groups.overdue}
            variant="overdue"
            toggling={toggling}
            onToggle={toggle}
          />
          <TaskGroup
            label="Σήμερα"
            tasks={groups.today}
            variant="today"
            toggling={toggling}
            onToggle={toggle}
          />
          <TaskGroup
            label="Επερχόμενες"
            tasks={groups.upcoming}
            variant="normal"
            toggling={toggling}
            onToggle={toggle}
          />
          <TaskGroup
            label="Χωρίς προθεσμία"
            tasks={groups.noDueDate}
            variant="normal"
            toggling={toggling}
            onToggle={toggle}
          />

          {groups.done.length > 0 && (
            <div>
              <button
                onClick={() => setShowDone((v) => !v)}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                {showDone ? '▾' : '▸'} Ολοκληρωμένες ({groups.done.length})
              </button>
              {showDone && (
                <div className="mt-3 space-y-2">
                  {groups.done.map((task) => (
                    <TaskCard key={task.id} task={task} toggling={toggling} onToggle={toggle} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task group ────────────────────────────────────────────────────────────────

type GroupProps = {
  label: string;
  tasks: Task[];
  variant: 'overdue' | 'today' | 'normal';
  toggling: string | null;
  onToggle: (t: Task) => void;
};

function TaskGroup({ label, tasks, variant, toggling, onToggle }: GroupProps) {
  if (tasks.length === 0) return null;

  const labelColor =
    variant === 'overdue' ? 'text-orange-400' :
    variant === 'today' ? 'text-primary' :
    'text-text-primary';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {variant === 'overdue' && <AlertCircle className="h-4 w-4 text-orange-400" />}
        <h2 className={`text-sm font-semibold ${labelColor}`}>{label} ({tasks.length})</h2>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} toggling={toggling} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────────────────

type CardProps = { task: Task; toggling: string | null; onToggle: (t: Task) => void };

function TaskCard({ task, toggling, onToggle }: CardProps) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.status === 'open' && !!task.due_date && task.due_date < today;
  const isDone = task.status === 'done';

  return (
    <div className={[
      'rounded-xl border p-4 flex items-start gap-3 transition-colors',
      isDone
        ? 'border-border/10 bg-secondary-background opacity-50'
        : overdue
          ? 'border-orange-500/20 bg-orange-500/5'
          : 'border-border/10 bg-secondary-background',
    ].join(' ')}>
      <button
        onClick={() => onToggle(task)}
        disabled={toggling === task.id}
        className={[
          'mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
          isDone
            ? 'border-green-500 bg-green-500 text-white'
            : overdue
              ? 'border-orange-400 hover:bg-orange-400/20'
              : 'border-border/30 hover:border-primary',
        ].join(' ')}
      >
        {isDone && <Check className="h-3 w-3" />}
        {!isDone && toggling === task.id && <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${isDone ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
            {task.title}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400">
              <AlertCircle className="h-2.5 w-2.5" />
              Ληξιπρόθεσμη
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-text-secondary mt-0.5">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-1">
          {task.due_date && (
            <span className={`text-xs ${overdue ? 'text-orange-400' : 'text-text-secondary'}`}>
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          )}
          {task.case_code && (
            <button
              onClick={() => navigate(`/cases/${task.case_id}`)}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              {task.case_code} — {task.case_title}
            </button>
          )}
          {isDone && task.completed_at && (
            <span className="text-xs text-text-secondary">
              Ολοκληρώθηκε {new Date(task.completed_at).toLocaleDateString('el-GR')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New task form ─────────────────────────────────────────────────────────────

type FormProps = { tenantId: string; onCreated: () => void; onCancel: () => void };

function NewTaskForm({ tenantId, onCreated, onCancel }: FormProps) {
  const [form, setForm] = useState({ title: '', description: '', due_date: '', case_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Case search
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [selectedCase, setSelectedCase] = useState<{ id: string; code: string; title: string } | null>(null);
  const [searchingCases, setSearchingCases] = useState(false);
  const [showCaseSearch, setShowCaseSearch] = useState(false);

  useEffect(() => {
    if (!caseQuery.trim() || !tenantId) { setCaseOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingCases(true);
      const results = await searchCasesForCall(tenantId, caseQuery.trim());
      setCaseOptions(results);
      setSearchingCases(false);
    }, 250);
    return () => clearTimeout(t);
  }, [caseQuery, tenantId]);

  const selectCase = (c: { id: string; code: string; title: string }) => {
    setSelectedCase(c);
    setForm((f) => ({ ...f, case_id: c.id }));
    setShowCaseSearch(false);
    setCaseQuery('');
    setCaseOptions([]);
  };

  const clearCase = () => {
    setSelectedCase(null);
    setForm((f) => ({ ...f, case_id: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTask(tenantId, form);
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Νέα Εργασία</h3>
        <button type="button" onClick={onCancel} className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Τίτλος <span className="text-danger">*</span></label>
        <input
          className="input w-full"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Προθεσμία</label>
          <input
            type="date"
            className="input w-full"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Υπόθεση</label>
          {selectedCase ? (
            <div className="flex items-center gap-2 input">
              <span className="font-mono text-xs text-text-secondary">{selectedCase.code}</span>
              <span className="text-sm text-text-primary flex-1 truncate">{selectedCase.title}</span>
              <button type="button" onClick={clearCase} className="text-text-secondary hover:text-danger cursor-pointer shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div>
              {!showCaseSearch ? (
                <button
                  type="button"
                  onClick={() => setShowCaseSearch(true)}
                  className="w-full flex items-center gap-2 input text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm">Επιλογή υπόθεσης</span>
                </button>
              ) : (
                <input
                  className="input w-full"
                  placeholder="Αναζήτηση…"
                  value={caseQuery}
                  onChange={(e) => setCaseQuery(e.target.value)}
                  autoFocus
                  onBlur={() => { if (!caseQuery.trim()) setShowCaseSearch(false); }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {showCaseSearch && caseOptions.length > 0 && (
        <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10 -mt-2">
          {searchingCases && <p className="px-3 py-2 text-xs text-text-secondary">Αναζήτηση…</p>}
          {caseOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCase(c)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors text-left"
            >
              <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
              <span className="text-sm text-text-primary truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
        <textarea
          className="input w-full resize-none"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary cursor-pointer">Ακύρωση</button>
        <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
          {saving ? 'Αποθήκευση…' : 'Δημιουργία'}
        </button>
      </div>
    </form>
  );
}
