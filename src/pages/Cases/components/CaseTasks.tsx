import { useEffect, useState } from 'react';
import { Plus, Check, RotateCcw, X, AlertCircle } from 'lucide-react';
import { fetchCaseTasks, completeTask, reopenTask } from '../caseUtils';
import { supabase } from '../../../lib/supabase';
import type { CaseTask } from '../types';

type Props = { caseId: string; tenantId?: string };

const emptyForm = { title: '', description: '', due_date: '' };

function isOverdue(task: CaseTask) {
  if (task.status === 'done' || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default function CaseTasks({ caseId }: Props) {
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseTasks(caseId).then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.functions.invoke('task-create', {
        body: { case_id: caseId, title: form.title, description: form.description, due_date: form.due_date },
      });
      if (err) throw err;
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (task: CaseTask) => {
    setToggling(task.id);
    try {
      if (task.status === 'open') {
        await completeTask(task.id);
      } else {
        await reopenTask(task.id);
      }
      load();
    } finally {
      setToggling(null);
    }
  };

  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {open.length} ανοιχτές · {done.length} ολοκληρωμένες
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Νέα Εργασία
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Νέα Εργασία</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Τίτλος <span className="text-danger">*</span>
            </label>
            <input
              className="input w-full"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Προθεσμία</label>
            <input
              className="input w-full"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
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
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary cursor-pointer">
              Ακύρωση
            </button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Δημιουργία'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν εργασίες για αυτή την υπόθεση.</p>
      ) : (
        <div className="space-y-2">
          {[...open, ...done].map((task) => {
            const overdue = isOverdue(task);
            return (
              <div
                key={task.id}
                className={[
                  'rounded-xl border p-4 flex items-start gap-3 transition-colors',
                  task.status === 'done'
                    ? 'border-border/10 bg-secondary-background opacity-60'
                    : overdue
                      ? 'border-orange-500/20 bg-orange-500/5'
                      : 'border-border/10 bg-secondary-background',
                ].join(' ')}
              >
                <button
                  onClick={() => toggle(task)}
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
                  {task.status === 'open' && toggling === task.id && (
                    <RotateCcw className="h-2.5 w-2.5 animate-spin text-text-secondary" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
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
                  {task.due_date && (
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-orange-400' : 'text-text-secondary'}`}>
                      Προθεσμία: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('el-GR')}
                    </p>
                  )}
                  {task.completed_at && (
                    <p className="text-xs text-text-secondary mt-0.5">
                      Ολοκληρώθηκε: {new Date(task.completed_at).toLocaleDateString('el-GR')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
