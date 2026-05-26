import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, RotateCcw, Euro } from 'lucide-react';
import { fetchCaseTasks } from '../caseUtils';
import type { CaseTask } from '../types';
import { fetchTaskPaymentsForTasks, type TaskPayment } from '../../Tasks/taskUtils';
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

export default function CaseFinancials({ caseId }: Props) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [payments, setPayments] = useState<TaskPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCaseTasks(caseId)
      .then(async (t) => {
        setTasks(t);
        const pays = await fetchTaskPaymentsForTasks(t.map(x => x.id));
        setPayments(pays);
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  const { totalFees, totalExpenses, totalPaid, balance, tasksWithFinancials } = useMemo(() => {
    const totalFees = tasks.reduce((s, t) => s + (t.fee ?? 0), 0);
    const totalExpenses = tasks.reduce((s, t) => s + (t.expenses ?? []).reduce((a, e) => a + e.amount, 0), 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balance = totalFees - totalExpenses;
    const tasksWithFinancials = tasks.filter((t) => (t.fee ?? 0) > 0 || (t.expenses ?? []).length > 0);
    return { totalFees, totalExpenses, totalPaid, balance, tasksWithFinancials };
  }, [tasks, payments]);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse-soft py-4">
      <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση οικονομικών…
    </div>
  );

  return (
    <div className="space-y-5">
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
          iconBg={balance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}
          iconColor={balance >= 0 ? 'text-green-500' : 'text-red-500'}
          label="Καθαρό Σύνολο"
          value={formatEur(balance)}
          valueColor={balance >= 0 ? 'text-green-500' : 'text-red-500'}
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
                <div key={t.id} className="px-4 py-3 space-y-2 hover:bg-border/5 transition-colors cursor-pointer" onClick={() => navigate(`/tasks/${t.id}`)}>
                  <div className="flex items-center gap-4">
                    <PieChart fee={taskFee} expenses={taskExpTotal} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-text-primary font-medium truncate">{t.title}</span>
                        <span className="text-xs text-text-secondary shrink-0">{t.due_date ? formatDate(t.due_date) : '—'}</span>
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
