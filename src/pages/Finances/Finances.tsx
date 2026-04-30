import { useEffect, useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchAllTasks, type Task } from '../Tasks/taskUtils';

type Period = 'week' | 'month' | 'year';

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

function periodKey(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === 'year') return `${d.getFullYear()}`;
  if (period === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  // week: ISO week label Mon
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  return mon.toISOString().slice(0, 10);
}

function periodLabel(key: string, period: Period): string {
  if (period === 'year') return key;
  if (period === 'month') {
    const [y, m] = key.split('-');
    const months = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
  // week: show "DD/MM"
  const d = new Date(key + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type DataPoint = { key: string; label: string; fees: number; expenses: number };

function LineChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null;

  const W = 600;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.fees, d.expenses]), 1);
  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const x = (i: number) => PAD.left + (data.length > 1 ? i * xStep : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const polyline = (vals: number[]) =>
    vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const feePoints = data.map((d) => d.fees);
  const expPoints = data.map((d) => d.expenses);

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: maxVal * f,
    yPos: y(maxVal * f),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 text-text-primary" preserveAspectRatio="none">
      {/* Grid lines */}
      {ticks.map((t) => (
        <g key={t.val}>
          <line x1={PAD.left} y1={t.yPos} x2={W - PAD.right} y2={t.yPos} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
          <text x={PAD.left - 6} y={t.yPos + 4} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.45">
            {t.val >= 1000 ? `${(t.val / 1000).toFixed(1)}k` : Math.round(t.val)}
          </text>
        </g>
      ))}

      {/* Fee line + area */}
      <polyline
        points={feePoints.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke="rgb(96 165 250 / 0.8)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Expense line */}
      <polyline
        points={expPoints.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke="rgb(248 113 113 / 0.8)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {data.map((d, i) => (
        <g key={d.key}>
          {d.fees > 0 && <circle cx={x(i)} cy={y(d.fees)} r="3" fill="rgb(96 165 250)" />}
          {d.expenses > 0 && <circle cx={x(i)} cy={y(d.expenses)} r="3" fill="rgb(248 113 113)" />}
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        const skip = data.length > 12 ? Math.ceil(data.length / 12) : 1;
        if (i % skip !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={d.key}
            x={x(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
          fillOpacity="0.45"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-text-secondary">
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" />
        Αμοιβές
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 bg-red-400 rounded" />
        Έξοδα
      </span>
    </div>
  );
}

export default function Finances() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    fetchAllTasks(tenantId).then(setTasks).finally(() => setLoading(false));
  }, [tenantId]);

  const financialTasks = useMemo(
    () => tasks.filter((t) => (t.fee ?? 0) > 0 || (t.expenses ?? []).length > 0),
    [tasks]
  );

  const last6MonthsData = useMemo(() => {
    const today = new Date();
    const months: DataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
      months.push({ key, label: monthNames[d.getMonth()], fees: 0, expenses: 0 });
    }
    for (const t of financialTasks) {
      const dateStr = t.due_date ?? t.created_at.slice(0, 10);
      const key = periodKey(dateStr, 'month');
      const slot = months.find((m) => m.key === key);
      if (!slot) continue;
      slot.fees += t.fee ?? 0;
      slot.expenses += (t.expenses ?? []).reduce((s, e) => s + e.amount, 0);
    }
    return months;
  }, [financialTasks]);

  const { chartData, totalFees, totalExpenses, net } = useMemo(() => {
    const map = new Map<string, { fees: number; expenses: number }>();

    for (const t of financialTasks) {
      const dateStr = t.due_date ?? t.created_at.slice(0, 10);
      const key = periodKey(dateStr, period);
      const cur = map.get(key) ?? { fees: 0, expenses: 0 };
      cur.fees += t.fee ?? 0;
      cur.expenses += (t.expenses ?? []).reduce((s, e) => s + e.amount, 0);
      map.set(key, cur);
    }

    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    const chartData: DataPoint[] = sorted.map(([key, v]) => ({
      key,
      label: periodLabel(key, period),
      ...v,
    }));

    const totalFees = chartData.reduce((s, d) => s + d.fees, 0);
    const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);
    const net = totalFees - totalExpenses;

    return { chartData, totalFees, totalExpenses, net };
  }, [financialTasks, period]);

  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: 'Εβδομάδα' },
    { value: 'month', label: 'Μήνας' },
    { value: 'year', label: 'Έτος' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-text-primary">Οικονομικά</h1>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={[
                'px-3 py-1 rounded-md text-sm font-medium transition-all cursor-pointer',
                period === p.value
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4">
          <div className="text-xs text-text-secondary mb-1">Σύνολο Αμοιβών</div>
          <div className="text-xl font-bold tabular-nums text-blue-400">{formatEur(totalFees)}</div>
        </div>
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4">
          <div className="text-xs text-text-secondary mb-1">Σύνολο Εξόδων</div>
          <div className="text-xl font-bold tabular-nums text-red-400">{formatEur(totalExpenses)}</div>
        </div>
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4">
          <div className="text-xs text-text-secondary mb-1">Καθαρό</div>
          <div className={`text-xl font-bold tabular-nums ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatEur(net)}</div>
        </div>
      </div>

      {/* Charts side by side */}
      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Last 6 months */}
          <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Τελευταίοι 6 Μήνες</span>
              <ChartLegend />
            </div>
            <LineChart data={last6MonthsData} />
          </div>

          {/* Period chart */}
          <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">Ανά Περίοδο</span>
              <ChartLegend />
            </div>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-secondary">
                <TrendingUp className="h-8 w-8 opacity-30" />
                <p className="text-sm">Δεν υπάρχουν δεδομένα.</p>
              </div>
            ) : (
              <LineChart data={chartData} />
            )}
          </div>
        </div>
      )}

      {/* Breakdown table */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Περίοδος</th>
                <th className="text-right px-4 py-2.5 font-medium">Αμοιβές</th>
                <th className="text-right px-4 py-2.5 font-medium">Έξοδα</th>
                <th className="text-right px-4 py-2.5 font-medium">Καθαρό</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {[...chartData].reverse().map((d) => {
                const rowNet = d.fees - d.expenses;
                return (
                  <tr key={d.key} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5 text-text-primary font-medium">{d.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-400">{formatEur(d.fees)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-400">{formatEur(d.expenses)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${rowNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatEur(rowNet)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
