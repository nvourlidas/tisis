import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, RotateCcw, Euro, Pencil, X, Plus, Trash2 } from 'lucide-react';
import { fetchCaseTasks } from '../caseUtils';
import type { CaseTask } from '../types';
import { fetchTaskPaymentsForTasks, fetchTaskPayments, createTaskPayment, deleteTaskPayment, type TaskPayment } from '../../Tasks/taskUtils';
import { formatDate } from '../../../lib/dateUtils';

type Props = { caseId: string; tenantId: string };

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

function PieChart({ fee, expenses }: { fee: number; expenses: number }) {
  const total = fee + expenses;
  if (total === 0) return null;
  const r = 20;
  const cx = 24;
  const cy = 24;
  const circumference = 2 * Math.PI * r;
  const feePct = fee / total;
  const expPct = expenses / total;

  if (feePct === 1) return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(59 130 246 / 0.7)" strokeWidth="8" />
    </svg>
  );
  if (expPct === 1) return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(239 68 68 / 0.7)" strokeWidth="8" />
    </svg>
  );

  const feeLen = feePct * circumference;
  const expLen = expPct * circumference;
  const gap = 1;

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(59 130 246 / 0.7)" strokeWidth="8"
        strokeDasharray={`${feeLen - gap} ${circumference - feeLen + gap}`} strokeDashoffset={0} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(239 68 68 / 0.7)" strokeWidth="8"
        strokeDasharray={`${expLen - gap} ${circumference - expLen + gap}`} strokeDashoffset={-(feeLen)} />
    </svg>
  );
}

function BarChart({ fees, expenses }: { fees: number; expenses: number }) {
  const total = fees + expenses;
  if (total === 0) return null;
  const pct = (v: number) => Math.round((v / total) * 100);
  const segments = [
    { label: 'Αμοιβές', value: fees, color: 'bg-blue-500', pct: pct(fees) },
    { label: 'Έξοδα', value: expenses, color: 'bg-red-500', pct: pct(expenses) },
  ].filter((s) => s.value > 0);

  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <div key={s.label} className={`${s.color} opacity-70 transition-all rounded-full`}
            style={{ width: `${s.pct}%` }} title={`${s.label}: ${formatEur(s.value)} (${s.pct}%)`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${s.color} opacity-70`} />
            {s.label} <span className="text-text-primary font-semibold">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CaseFinancials({ caseId, tenantId }: Props) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [payments, setPayments] = useState<TaskPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<CaseTask | null>(null);

  const reload = () => {
    setLoading(true);
    fetchCaseTasks(caseId)
      .then(async (t) => {
        setTasks(t);
        const pays = await fetchTaskPaymentsForTasks(t.map(x => x.id));
        setPayments(pays);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [caseId]);

  const { totalFees, totalExpenses, totalPaid, balance, tasksWithFinancials } = useMemo(() => {
    const totalFees = tasks.reduce((s, t) => s + (t.fee ?? 0), 0);
    const totalExpenses = tasks.reduce((s, t) => s + (t.expenses ?? []).reduce((a, e) => a + e.amount, 0), 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balance = totalFees - totalPaid;
    const tasksWithFinancials = tasks.filter((t) => (t.fee ?? 0) > 0 || (t.expenses ?? []).length > 0);
    return { totalFees, totalExpenses, totalPaid, balance, tasksWithFinancials };
  }, [tasks, payments]);

  if (loading && tasks.length === 0) return (
    <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse-soft py-4">
      <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση οικονομικών…
    </div>
  );

  return (
    <div className="space-y-5">
      <FinancialsEditModal
        task={editingTask}
        tenantId={tenantId}
        onClose={() => setEditingTask(null)}
        onSaved={() => { setEditingTask(null); reload(); }}
      />
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          label="Αμοιβές"
          value={formatEur(totalFees)}
          valueColor="text-blue-500"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          label="Έξοδα"
          value={formatEur(totalExpenses)}
          valueColor="text-red-500"
        />
        <SummaryCard
          icon={<Euro className="h-5 w-5" />}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
          label="Εισπραχθέντα"
          value={formatEur(totalPaid)}
          valueColor="text-green-500"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
          label="Υπόλοιπο"
          value={formatEur(balance)}
          valueColor="text-orange-500"
        />
      </div>

      <BarChart fees={totalFees} expenses={totalExpenses} />

      {tasksWithFinancials.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
          <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
            <Wallet className="h-6 w-6 opacity-30" />
          </div>
          <p className="text-sm">Δεν υπάρχουν οικονομικά στοιχεία από εργασίες.</p>
        </div>
      ) : (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Ανά Εργασία
          </h3>
          <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
            {tasksWithFinancials.map((t) => {
              const taskExpTotal = (t.expenses ?? []).reduce((s, e) => s + e.amount, 0);
              const taskPayments = payments.filter(p => p.task_id === t.id);
              const taskPaid = taskPayments.reduce((s, p) => s + p.amount, 0);
              const taskFee = t.fee ?? 0;
              const taskRemaining = taskFee - taskPaid;
              const paidPct = taskFee > 0 ? Math.min(100, (taskPaid / taskFee) * 100) : 0;

              return (
                <div key={t.id} className="px-4 py-3 space-y-2 hover:bg-border/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <PieChart fee={taskFee} expenses={taskExpTotal} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => navigate(`/tasks/${t.id}`)} className="text-sm text-text-primary font-medium truncate hover:underline cursor-pointer text-left">{t.title}</button>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-text-secondary">{t.due_date ? formatDate(t.due_date) : '—'}</span>
                          <button
                            onClick={() => setEditingTask(t)}
                            className="p-1 rounded hover:bg-white/8 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            title="Επεξεργασία οικονομικών"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {taskFee > 0 && (
                          <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium tabular-nums">
                            Αμοιβή: {formatEur(taskFee)}
                          </span>
                        )}
                        {(t.expenses ?? []).map((exp, i) => (
                          <span key={i} className="text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full font-medium tabular-nums">
                            {exp.description || 'Έξοδο'}: {formatEur(exp.amount)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Payment progress — only if task has a fee */}
                  {taskFee > 0 && (
                    <div className="ml-16 space-y-1.5">
                      <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <div className="flex gap-3 text-[11px]">
                        <span className="text-green-500">Πληρωμένο: <strong>{formatEur(taskPaid)}</strong></span>
                        {taskRemaining > 0 && (
                          <span className="text-orange-400">Υπόλοιπο: <strong>{formatEur(taskRemaining)}</strong></span>
                        )}
                        {taskRemaining <= 0 && taskPaid > 0 && (
                          <span className="text-green-500 font-semibold">Εξοφλήθηκε</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function FinancialsEditModal({ task, tenantId, onClose, onSaved }: {
  task: CaseTask | null;
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [taskPayments, setTaskPayments] = useState<TaskPayment[]>([]);
  const [loadingPay, setLoadingPay] = useState(false);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = (taskId: string) => {
    setLoadingPay(true);
    fetchTaskPayments(taskId).then(setTaskPayments).finally(() => setLoadingPay(false));
  };

  useEffect(() => {
    if (!task) return;
    setAmount('');
    setPaidAt(todayStr);
    setNotes('');
    setError(null);
    loadPayments(task.id);
  }, [task?.id]);

  if (!task) return null;

  const taskFee = task.fee ?? 0;
  const totalPaid = taskPayments.reduce((s, p) => s + p.amount, 0);
  const remaining = taskFee - totalPaid;

  const handleAdd = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await createTaskPayment(tenantId, task.id, { amount: Number(amount), paid_at: paidAt, notes: notes || undefined });
      setAmount('');
      setNotes('');
      loadPayments(task.id);
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Διαγραφή πληρωμής;')) return;
    await deleteTaskPayment(id);
    loadPayments(task.id);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/10">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Πληρωμές Εργασίας</h2>
            <p className="text-xs text-text-secondary mt-0.5 truncate max-w-xs">{task.title}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {taskFee > 0 && (
            <div className="rounded-xl border border-border/10 bg-white/3 px-4 py-3 flex flex-wrap gap-4 text-xs">
              <span className="text-text-secondary">Αμοιβή: <span className="text-blue-500 font-semibold">{formatEur(taskFee)}</span></span>
              <span className="text-text-secondary">Πληρωμένο: <span className="text-green-500 font-semibold">{formatEur(totalPaid)}</span></span>
              {remaining > 0 && <span className="text-text-secondary">Υπόλοιπο: <span className="text-orange-400 font-semibold">{formatEur(remaining)}</span></span>}
              {remaining <= 0 && totalPaid > 0 && <span className="text-green-500 font-semibold">Εξοφλήθηκε</span>}
            </div>
          )}

          {/* Existing payments */}
          {loadingPay ? (
            <p className="text-xs text-text-secondary">Φόρτωση…</p>
          ) : taskPayments.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Καταχωρημένες πληρωμές</p>
              {taskPayments.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/10 bg-white/2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-green-500">{formatEur(p.amount)}</span>
                    <span className="text-xs text-text-secondary ml-2">{formatDate(p.paid_at)}</span>
                    {p.notes && <p className="text-xs text-text-secondary truncate">{p.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(p.id)} className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">Δεν υπάρχουν πληρωμές ακόμα.</p>
          )}

          {/* Add payment form */}
          <div className="border-t border-border/10 pt-4 space-y-3">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Νέα πληρωμή</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Ποσό (€)</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className="input w-full text-sm rounded-xl" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ημερομηνία</label>
                <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className="input text-sm rounded-xl" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Προαιρετικά…" className="input w-full text-sm rounded-xl" />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-white/5 cursor-pointer">Κλείσιμο</button>
              <button onClick={handleAdd} disabled={saving || !amount || Number(amount) <= 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 cursor-pointer disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" />
                {saving ? 'Αποθήκευση…' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, iconBg, iconColor, label, value, valueColor }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className={`text-lg font-bold tabular-nums ${valueColor}`}>{value}</p>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
