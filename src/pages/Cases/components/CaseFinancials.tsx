import { useEffect, useState, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { fetchCaseTasks } from '../caseUtils';
import type { CaseTask } from '../types';
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

  if (feePct === 1) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(96 165 250 / 0.7)" strokeWidth="8" />
      </svg>
    );
  }
  if (expPct === 1) {
    return (
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(248 113 113 / 0.7)" strokeWidth="8" />
      </svg>
    );
  }

  const feeLen = feePct * circumference;
  const expLen = expPct * circumference;
  const gap = 1;

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgb(96 165 250 / 0.7)"
        strokeWidth="8"
        strokeDasharray={`${feeLen - gap} ${circumference - feeLen + gap}`}
        strokeDashoffset={0}
      />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgb(248 113 113 / 0.7)"
        strokeWidth="8"
        strokeDasharray={`${expLen - gap} ${circumference - expLen + gap}`}
        strokeDashoffset={-(feeLen)}
      />
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
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} opacity-70 transition-all`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${formatEur(s.value)} (${s.pct}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${s.color} opacity-70`} />
            {s.label} <span className="text-text-primary font-medium">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CaseFinancials({ caseId }: Props) {
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCaseTasks(caseId).then(setTasks).finally(() => setLoading(false));
  }, [caseId]);

  const { totalFees, totalExpenses, balance, tasksWithFinancials } = useMemo(() => {
    const totalFees = tasks.reduce((s, t) => s + (t.fee ?? 0), 0);
    const totalExpenses = tasks.reduce((s, t) => s + (t.expenses ?? []).reduce((a, e) => a + e.amount, 0), 0);
    const balance = totalFees - totalExpenses;
    const tasksWithFinancials = tasks.filter((t) => (t.fee ?? 0) > 0 || (t.expenses ?? []).length > 0);
    return { totalFees, totalExpenses, balance, tasksWithFinancials };
  }, [tasks]);

  if (loading) return <p className="text-sm text-text-secondary">Φόρτωση…</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Αμοιβές" value={formatEur(totalFees)} color="text-blue-400" />
        <SummaryCard label="Έξοδα" value={formatEur(totalExpenses)} color="text-red-400" />
        <SummaryCard
          label="Καθαρό Σύνολο"
          value={formatEur(balance)}
          color={balance >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      <BarChart fees={totalFees} expenses={totalExpenses} />

      {tasksWithFinancials.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν οικονομικά στοιχεία από εργασίες.</p>
      ) : (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Από Εργασίες
          </h3>
          <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
            {tasksWithFinancials.map((t) => {
              const taskExpTotal = (t.expenses ?? []).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={t.id} className="px-4 py-3 flex items-center gap-4 hover:bg-white/3 transition-colors">
                  <PieChart fee={t.fee ?? 0} expenses={taskExpTotal} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-primary font-medium truncate">{t.title}</span>
                      <span className="text-xs text-text-secondary shrink-0">{t.due_date ? formatDate(t.due_date) : '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {(t.fee ?? 0) > 0 && (
                        <span className="text-blue-400">Αμοιβή: <span className="font-medium tabular-nums">{formatEur(t.fee!)}</span></span>
                      )}
                      {(t.expenses ?? []).map((exp, i) => (
                        <span key={i} className="text-red-400">{exp.description || 'Έξοδο'}: <span className="font-medium tabular-nums">{formatEur(exp.amount)}</span></span>
                      ))}
                      {taskExpTotal > 0 && (t.expenses ?? []).length > 1 && (
                        <span className="text-text-secondary">Σύνολο Εξόδων: <span className="font-medium tabular-nums text-red-400">{formatEur(taskExpTotal)}</span></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-3">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className={`text-base font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
