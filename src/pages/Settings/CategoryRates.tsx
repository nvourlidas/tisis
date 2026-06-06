import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../../auth';
import { fetchCategoryRates, upsertCategoryRate, TASK_CATEGORIES } from '../Tasks/taskUtils';
import type { CategoryRate, TaskCategory } from '../Tasks/taskUtils';

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CategoryRates() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [rates, setRates] = useState<CategoryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<TaskCategory | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<TaskCategory, string>>>({});
  const [saved, setSaved] = useState<Partial<Record<TaskCategory, boolean>>>({});

  const load = () => {
    if (!tenantId) return;
    setLoading(true);
    fetchCategoryRates(tenantId)
      .then(data => {
        setRates(data);
        const initial: Partial<Record<TaskCategory, string>> = {};
        for (const r of data) {
          initial[r.category] = r.rate_per_hour > 0 ? String(r.rate_per_hour) : '';
        }
        setDrafts(initial);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleSave = async (category: TaskCategory) => {
    const val = drafts[category] ?? '';
    const rate = val === '' ? 0 : parseFloat(val);
    if (isNaN(rate) || rate < 0) return;
    setSaving(category);
    try {
      await upsertCategoryRate(tenantId, category, rate);
      setSaved(prev => ({ ...prev, [category]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [category]: false })), 2000);
      load();
    } finally {
      setSaving(null);
    }
  };

  const categories = Object.entries(TASK_CATEGORIES) as [TaskCategory, string][];

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-text-secondary" />
        <h1 className="text-xl font-semibold">Χρεώσεις ανά Κατηγορία</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Ορίστε ωριαία χρέωση για κάθε κατηγορία εργασίας. Χρησιμοποιείται για αυτόματο υπολογισμό ποσού κατά την καταχώρηση ωρών σε εργασίες.
      </p>

      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση...</p>
      ) : (
        <div className="space-y-3">
          {categories.map(([cat, label]) => {
            const current = rates.find(r => r.category === cat);
            const draft = drafts[cat] ?? '';
            const isSaving = saving === cat;
            const didSave = saved[cat];

            return (
              <div key={cat} className="flex items-center gap-3 rounded-xl border border-border/10 bg-bg-card p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  {current && current.rate_per_hour > 0 && (
                    <p className="text-xs text-text-secondary">{formatEur(current.rate_per_hour)}/ώρα</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary">€</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      placeholder="0"
                      value={draft}
                      onChange={e => setDrafts(prev => ({ ...prev, [cat]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleSave(cat)}
                      className="w-28 pl-6 pr-2 py-1.5 text-sm rounded-lg border border-border/20 bg-bg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={() => handleSave(cat)}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors min-w-[56px]"
                  >
                    {didSave ? '✓' : isSaving ? '...' : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
