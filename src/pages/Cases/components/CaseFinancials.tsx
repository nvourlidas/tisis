import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { fetchCaseFinancials, createFinancial } from '../caseUtils';
import type { CaseFinancial } from '../types';
import { formatDate } from '../../../lib/dateUtils';

type Props = { caseId: string; tenantId: string };

const TYPE_LABELS: Record<string, string> = {
  fee: 'Αμοιβή',
  expense: 'Έξοδο',
  receipt: 'Είσπραξη',
};

const TYPE_COLORS: Record<string, string> = {
  fee: 'bg-blue-500/15 text-blue-400',
  expense: 'bg-red-500/15 text-red-400',
  receipt: 'bg-green-500/15 text-green-400',
};

const emptyForm = {
  type: 'fee' as 'fee' | 'expense' | 'receipt',
  amount: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
};

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CaseFinancials({ caseId, tenantId }: Props) {
  const [entries, setEntries] = useState<CaseFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseFinancials(caseId).then(setEntries).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setError('Εισάγετε έγκυρο ποσό.'); return; }
    setSaving(true);
    setError(null);
    try {
      await createFinancial(tenantId, caseId, {
        type: form.type,
        amount,
        description: form.description,
        date: form.date,
      });
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία καταχώρησης.');
    } finally {
      setSaving(false);
    }
  };

  const balance = entries.reduce((acc, e) => {
    if (e.type === 'receipt') return acc + e.amount;
    if (e.type === 'fee') return acc - e.amount;
    if (e.type === 'expense') return acc - e.amount;
    return acc;
  }, 0);

  const totalFees = entries.filter((e) => e.type === 'fee').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalReceipts = entries.filter((e) => e.type === 'receipt').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{entries.length} εγγραφές</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Νέα Εγγραφή
        </button>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Αμοιβές" value={formatEur(totalFees)} color="text-blue-400" />
          <SummaryCard label="Έξοδα" value={formatEur(totalExpenses)} color="text-red-400" />
          <SummaryCard label="Εισπράξεις" value={formatEur(totalReceipts)} color="text-green-400" />
          <SummaryCard
            label="Υπόλοιπο"
            value={formatEur(balance)}
            color={balance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Νέα Εγγραφή</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1">Τύπος</label>
              <select
                className="input w-full"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
              >
                <option value="fee">Αμοιβή</option>
                <option value="expense">Έξοδο</option>
                <option value="receipt">Είσπραξη</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Ποσό (€) <span className="text-danger">*</span>
              </label>
              <input
                className="input w-full"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Ημερομηνία</label>
              <input
                className="input w-full"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
            <input
              className="input w-full"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="π.χ. Παράσταση δικαστηρίου"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary cursor-pointer">
              Ακύρωση
            </button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Καταχώρηση'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν οικονομικές εγγραφές για αυτή την υπόθεση.</p>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Τύπος</th>
                <th className="text-left px-4 py-2.5 font-medium">Περιγραφή</th>
                <th className="text-right px-4 py-2.5 font-medium">Ποσό</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Ημερομηνία</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[e.type] ?? ''}`}>
                      {TYPE_LABELS[e.type] ?? e.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{e.description ?? '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                    e.type === 'receipt' ? 'text-green-400' : e.type === 'expense' ? 'text-red-400' : 'text-blue-400'
                  }`}>
                    {e.type === 'receipt' ? '+' : '-'}{formatEur(e.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">
                    {formatDate(e.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
