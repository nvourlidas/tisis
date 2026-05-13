import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, RotateCcw,
  Minus, BarChart2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
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
    return `${months[parseInt(m) - 1]} ${y.slice(-2)}`;
  }
  const d = new Date(key + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type DataPoint = { key: string; label: string; fees: number; expenses: number };

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/15 bg-secondary-background/95 backdrop-blur shadow-xl px-3.5 py-2.5 text-sm space-y-1">
      <div className="font-bold text-text-primary mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary">{p.name === 'fees' ? 'Αμοιβές' : 'Έξοδα'}</span>
          <span className="font-semibold ml-auto pl-4" style={{ color: p.color }}>{formatEur(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Custom dot ────────────────────────────────────────────────────────────────

function CustomDot({ cx, cy, value, color }: any) {
  if (!value) return null;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth={1.5} />;
}

// ── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) return null;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null;
  if (diff > 0) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-500 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-full">
      <TrendingUp className="h-3 w-3" />{pct !== null ? `+${pct}%` : `+${formatEur(diff)}`}
    </span>
  );
  if (diff < 0) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full">
      <TrendingDown className="h-3 w-3" />{pct !== null ? `${pct}%` : formatEur(diff)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-text-secondary bg-border/10 border border-border/20 px-2 py-0.5 rounded-full">
      <Minus className="h-3 w-3" />0%
    </span>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, icon, data, summaryItems, trendCurrent, trendPrev, empty,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  data: DataPoint[];
  summaryItems: { label: string; value: string }[];
  trendCurrent: number;
  trendPrev: number;
  empty?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/10 bg-secondary-background shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-black text-text-primary tracking-tight">{title}</h2>
            <p className="text-[11px] text-text-secondary mt-0.5">{subtitle}</p>
          </div>
        </div>
        {!empty && <TrendBadge current={trendCurrent} previous={trendPrev} />}
      </div>

      {/* Summary strip */}
      {!empty && (
        <div className="px-5 py-3 border-b border-border/5 flex items-center gap-6 flex-wrap">
          {summaryItems.map((s) => (
            <div key={s.label}>
              <div className="text-base font-black text-text-primary tabular-nums">{s.value}</div>
              <div className="text-[11px] text-text-secondary">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart body */}
      <div className="px-4 pb-5 pt-4">
        {empty ? (
          <div className="h-44 flex flex-col items-center justify-center gap-2 text-text-secondary">
            <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
              <BarChart2 className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm">Δεν υπάρχουν δεδομένα.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(96 165 250)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="rgb(96 165 250)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(248 113 113)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="rgb(248 113 113)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-text-primary)"
                opacity={0.08}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 2', strokeOpacity: 0.5 }}
              />
              <Area
                type="monotone"
                dataKey="fees"
                stroke="rgb(96 165 250)"
                strokeWidth={2.5}
                fill="url(#feesGrad)"
                dot={<CustomDot color="rgb(96 165 250)" />}
                activeDot={{ r: 6, fill: 'rgb(96 165 250)', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="rgb(248 113 113)"
                strokeWidth={2.5}
                fill="url(#expensesGrad)"
                dot={<CustomDot color="rgb(248 113 113)" />}
                activeDot={{ r: 6, fill: 'rgb(248 113 113)', stroke: 'rgba(0,0,0,0.3)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!empty && (
          <div className="flex items-center gap-4 text-xs text-text-secondary mt-1 px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'rgb(96 165 250)' }} />
              Αμοιβές
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'rgb(248 113 113)' }} />
              Έξοδα
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    const monthNames = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
    const months: DataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`, fees: 0, expenses: 0 });
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
    const chartData: DataPoint[] = sorted.map(([key, v]) => ({ key, label: periodLabel(key, period), ...v }));
    const totalFees = chartData.reduce((s, d) => s + d.fees, 0);
    const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);
    const net = totalFees - totalExpenses;
    return { chartData, totalFees, totalExpenses, net };
  }, [financialTasks, period]);

  const trendFeeCurrent = last6MonthsData[last6MonthsData.length - 1]?.fees ?? 0;
  const trendFeePrev    = last6MonthsData[last6MonthsData.length - 2]?.fees ?? 0;
  const trendNetCurrent = (chartData[chartData.length - 1]?.fees ?? 0) - (chartData[chartData.length - 1]?.expenses ?? 0);
  const trendNetPrev    = (chartData[chartData.length - 2]?.fees ?? 0) - (chartData[chartData.length - 2]?.expenses ?? 0);

  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: 'Εβδομάδα' },
    { value: 'month', label: 'Μήνας' },
    { value: 'year', label: 'Έτος' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-fade-in-up flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Οικονομικά</h1>
          <p className="text-sm text-text-secondary mt-0.5">Αμοιβές & έξοδα από εργασίες</p>
        </div>
        <div className="flex rounded-xl border border-border/15 overflow-hidden text-xs">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-2 font-medium transition-colors cursor-pointer ${period === p.value ? 'bg-primary text-white' : 'text-text-secondary hover:bg-white/5'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="animate-fade-in-up stagger-1 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-blue-500">{formatEur(totalFees)}</p>
            <p className="text-xs text-text-secondary mt-0.5">Σύνολο Αμοιβών</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/10 text-red-500">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-red-500">{formatEur(totalExpenses)}</p>
            <p className="text-xs text-text-secondary mt-0.5">Σύνολο Εξόδων</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-lg font-bold tabular-nums ${net >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatEur(net)}</p>
            <p className="text-xs text-text-secondary mt-0.5">Καθαρό</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft py-8">
          <RotateCcw className="h-4 w-4 animate-spin" />
          Φόρτωση οικονομικών…
        </div>
      ) : (
        <div className="animate-fade-in-up stagger-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Τελευταίοι 6 Μήνες"
            subtitle="Αμοιβές & έξοδα ανά μήνα"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            data={last6MonthsData}
            trendCurrent={trendFeeCurrent}
            trendPrev={trendFeePrev}
            empty={last6MonthsData.every((d) => d.fees === 0 && d.expenses === 0)}
            summaryItems={[
              { label: 'Αμοιβές 6μήνου', value: formatEur(last6MonthsData.reduce((s, d) => s + d.fees, 0)) },
              { label: 'Έξοδα 6μήνου', value: formatEur(last6MonthsData.reduce((s, d) => s + d.expenses, 0)) },
              { label: 'Τρέχων μήνας', value: formatEur(trendFeeCurrent) },
            ]}
          />
          <ChartCard
            title="Ανά Περίοδο"
            subtitle={`Ομαδοποίηση: ${periods.find(p => p.value === period)?.label}`}
            icon={<BarChart2 className="h-4 w-4 text-primary" />}
            data={chartData}
            trendCurrent={trendNetCurrent}
            trendPrev={trendNetPrev}
            empty={chartData.length === 0}
            summaryItems={[
              { label: 'Περίοδοι', value: String(chartData.length) },
              { label: 'Υψηλότερο καθαρό', value: formatEur(Math.max(...chartData.map(d => d.fees - d.expenses), 0)) },
              { label: 'Τελευταία περίοδος', value: formatEur(trendNetCurrent) },
            ]}
          />
        </div>
      )}

      {/* Breakdown table */}
      {!loading && chartData.length > 0 && (
        <div className="animate-fade-in-up stagger-3 rounded-xl border border-border/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/10 bg-white/2">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Ανάλυση ανά Περίοδο</h3>
          </div>
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
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-500 font-medium">{formatEur(d.fees)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-500 font-medium">{formatEur(d.expenses)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${rowNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
