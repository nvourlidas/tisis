import { useEffect, useState, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Wallet, Euro, RotateCcw, Plus, Trash2, ChevronDown, ChevronRight, X, Clock, CheckCircle2, Paperclip, Loader2, Upload, ExternalLink, FileText } from 'lucide-react';
import { fetchCaseFees, createCaseFee, deleteCaseFee, createFeePayment, deleteFeePayment, fetchCaseExpenses, createCaseExpense, deleteCaseExpense, fetchCaseTasks, linkTaskToFee } from '../caseUtils';
import type { CaseFee, FeePayment, CaseExpense, CaseTask } from '../types';
import { formatDate } from '../../../lib/dateUtils';
import { fetchCategoryRates, calcTaskAmount, TASK_CATEGORIES } from '../../Tasks/taskUtils';
import { useAuth } from '../../../auth';
import { supabase } from '../../../lib/supabase';
import { callDriveSync, uploadFileToDrive, findOrCreateSubfolder } from '../../../lib/googleDrive';

const EXPENSES_SUBFOLDER = 'Έξοδα';

type Props = { caseId: string; tenantId: string; folderId: string | null };

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CaseFinancials({ caseId, tenantId, folderId }: Props) {
  const { profile } = useAuth();
  const [fees, setFees] = useState<CaseFee[]>([]);
  const [expenses, setExpenses] = useState<CaseExpense[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [rates, setRates] = useState<Awaited<ReturnType<typeof fetchCategoryRates>>>([]);
  const [totalTaskHours, setTotalTaskHours] = useState(0);
  const [totalTaskAmount, setTotalTaskAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewFee, setShowNewFee] = useState(false);
  const [showNewExpense, setShowNewExpense] = useState(false);
  const [expandedFees, setExpandedFees] = useState<Set<string>>(new Set());
  const [addingPaymentFor, setAddingPaymentFor] = useState<string | null>(null);
  const [linkingTaskFor, setLinkingTaskFor] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    const tid = tenantId || (profile?.tenant_id ?? '');
    Promise.all([fetchCaseFees(caseId), fetchCaseExpenses(caseId), fetchCaseTasks(caseId), tid ? fetchCategoryRates(tid) : Promise.resolve([])])
      .then(([f, e, t, r]) => {
        setFees(f);
        setExpenses(e);
        setTasks(t);
        setRates(r);
        const hours = t.reduce((s, task) => s + (task.hours ?? 0), 0);
        setTotalTaskHours(hours);
        const amounts = t.map(task => calcTaskAmount(task.hours, r, task.category));
        const hasAny = amounts.some(a => a != null);
        setTotalTaskAmount(hasAny ? amounts.reduce((s, a) => (s ?? 0) + (a ?? 0), 0) : null);
      })
      .finally(() => setLoading(false));
  };

  const handleLinkTask = async (taskId: string, feeId: string) => {
    await linkTaskToFee(taskId, feeId);
    reload();
  };

  const handleUnlinkTask = async (taskId: string) => {
    await linkTaskToFee(taskId, null);
    reload();
  };

  useEffect(() => { reload(); }, [caseId]);

  const { totalAgreed, totalPaid, totalExpenses, balance } = useMemo(() => {
    const totalAgreed = fees.reduce((s, f) => s + f.amount, 0);
    const totalPaid = fees.reduce((s, f) => s + (f.payments ?? []).reduce((sp, p) => sp + p.amount, 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    return { totalAgreed, totalPaid, totalExpenses, balance: totalAgreed - totalPaid };
  }, [fees, expenses]);

  const toggleExpand = (id: string) => {
    setExpandedFees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteExpense = async (exp: CaseExpense) => {
    if (!confirm('Διαγραφή εξόδου;')) return;
    await deleteCaseExpense(exp.id);
    if (exp.drive_file_id) {
      callDriveSync({ action: 'delete-file', fileId: exp.drive_file_id }).catch(() => {});
    }
    reload();
  };

  const handleDeleteFee = async (id: string) => {
    if (!confirm('Διαγραφή συμφωνίας αμοιβής και όλων των πληρωμών της;')) return;
    await deleteCaseFee(id);
    reload();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Διαγραφή πληρωμής;')) return;
    await deleteFeePayment(paymentId);
    reload();
  };

  if (loading && fees.length === 0) return (
    <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse-soft py-4">
      <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση οικονομικών…
    </div>
  );

  const tasksWithHours = tasks.filter(t => t.hours != null && t.hours > 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-blue-500/10" iconColor="text-blue-500"
          label="Αμοιβές"
          value={formatEur(totalAgreed)} valueColor="text-blue-500"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5" />}
          iconBg="bg-red-500/10" iconColor="text-red-500"
          label="Έξοδα"
          value={formatEur(totalExpenses)} valueColor="text-red-500"
        />
        <SummaryCard
          icon={<Euro className="h-5 w-5" />}
          iconBg="bg-green-500/10" iconColor="text-green-500"
          label="Εισπραχθέντα"
          value={formatEur(totalPaid)} valueColor="text-green-500"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          iconBg="bg-orange-500/10" iconColor="text-orange-500"
          label="Υπόλοιπο"
          value={(balance < 0 ? '+' : '') + formatEur(Math.abs(balance))}
          valueColor={balance <= 0 ? 'text-green-500' : 'text-orange-500'}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* LEFT — Fees + Expenses */}
        <div className="space-y-5">
          {/* Add fee button */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Συμφωνίες Αμοιβής ({fees.length})
            </h3>
            <button
              onClick={() => setShowNewFee(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/15 text-xs text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Νέα Συμφωνία
            </button>
          </div>

          {showNewFee && (
            <NewFeeForm
              tenantId={tenantId}
              caseId={caseId}
              onSaved={() => { setShowNewFee(false); reload(); }}
              onCancel={() => setShowNewFee(false)}
            />
          )}

          {fees.length === 0 && !showNewFee ? (
            <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
              <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
                <Wallet className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm">Δεν υπάρχουν συμφωνίες αμοιβής.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
              {fees.map((fee) => {
                const paid = (fee.payments ?? []).reduce((s, p) => s + p.amount, 0);
                const remaining = fee.amount - paid;
                const paidPct = fee.amount > 0 ? Math.min(100, (paid / fee.amount) * 100) : 0;
                const expanded = expandedFees.has(fee.id);
                const addingPayment = addingPaymentFor === fee.id;
                const feeLinkedTasks = tasks.filter(t => t.fee_id === fee.id);
                const feeHours = feeLinkedTasks.reduce((s, t) => s + (t.hours ?? 0), 0);
                const feeAmounts = feeLinkedTasks.map(t => calcTaskAmount(t.hours, rates, t.category));
                const feeTaskAmount = feeAmounts.some(a => a != null)
                  ? feeAmounts.reduce((s, a) => (s ?? 0) + (a ?? 0), 0)
                  : null;

                return (
                  <div key={fee.id} className="bg-secondary-background">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                      <button onClick={() => toggleExpand(fee.id)} className="shrink-0 text-text-secondary cursor-pointer">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-blue-500">{formatEur(fee.amount)}</span>
                            {fee.agreement_date && (
                              <span className="text-xs text-text-secondary">Ημ. Συμφωνίας: {formatDate(fee.agreement_date)}</span>
                            )}
                            {feeHours > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                                <Clock className="h-3 w-3" />
                                {feeHours}ω{feeTaskAmount != null ? ` · ${formatEur(feeTaskAmount)}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setAddingPaymentFor(addingPayment ? null : fee.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/15 text-xs text-text-secondary hover:text-text-primary hover:bg-border/5 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              Πληρωμή
                            </button>
                            <button onClick={() => handleDeleteFee(fee.id)} className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${paidPct}%` }} />
                          </div>
                          <div className="flex gap-3 text-[11px]">
                            <span className="text-green-500">Πληρωμένο: <strong>{formatEur(paid)}</strong></span>
                            {remaining > 0 && <span className="text-orange-400">Υπόλοιπο: <strong>{formatEur(remaining)}</strong></span>}
                            {remaining <= 0 && paid > 0 && <span className="text-green-500 font-semibold">Εξοφλήθηκε</span>}
                          </div>
                        </div>
                        {fee.notes && <p className="text-xs text-text-secondary">{fee.notes}</p>}
                      </div>
                    </div>

                    {addingPayment && (
                      <AddPaymentForm
                        tenantId={tenantId}
                        feeId={fee.id}
                        onSaved={() => { setAddingPaymentFor(null); reload(); }}
                        onCancel={() => setAddingPaymentFor(null)}
                      />
                    )}

                    {expanded && (fee.payments ?? []).length > 0 && (
                      <div className="border-t border-border/10 divide-y divide-border/10">
                        {(fee.payments ?? []).map((p) => (
                          <PaymentRow key={p.id} payment={p} onDelete={handleDeletePayment} />
                        ))}
                      </div>
                    )}
                    {expanded && (fee.payments ?? []).length === 0 && (
                      <div className="border-t border-border/10 px-4 py-3">
                        <p className="text-xs text-text-secondary">Δεν υπάρχουν πληρωμές ακόμα.</p>
                      </div>
                    )}

                    {expanded && (() => {
                      const linkedTasks = tasks.filter(t => t.fee_id === fee.id);
                      const unlinkableTasks = tasks.filter(t => t.fee_id == null);
                      const showPicker = linkingTaskFor === fee.id;
                      return (
                        <div className="border-t border-border/10">
                          <div className="flex items-center justify-between px-4 py-2">
                            <span className="text-xs font-medium text-text-secondary">Εργασίες ({linkedTasks.length})</span>
                            {unlinkableTasks.length > 0 && (
                              <button
                                onClick={() => setLinkingTaskFor(showPicker ? null : fee.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/15 text-xs text-text-secondary hover:text-text-primary hover:bg-border/5 cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                Σύνδεση
                              </button>
                            )}
                          </div>
                          {linkedTasks.length > 0 && (
                            <div className="divide-y divide-border/10">
                              {linkedTasks.map(t => (
                                <div key={t.id} className="flex items-center gap-3 px-10 py-2 hover:bg-white/2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${t.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-400'}`}>
                                    {t.status === 'done' ? '✓' : '○'}
                                  </span>
                                  <span className="flex-1 text-xs text-text-primary truncate">{t.title}</span>
                                  {t.hours != null && <span className="text-xs text-text-secondary">{t.hours}ω</span>}
                                  <button onClick={() => handleUnlinkTask(t.id)} className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {showPicker && (
                            <div className="mx-4 mb-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2 space-y-1">
                              <p className="text-xs text-text-secondary mb-1">Επιλέξτε εργασία:</p>
                              {unlinkableTasks.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleLinkTask(t.id, fee.id)}
                                  className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 text-left cursor-pointer"
                                >
                                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${t.status === 'done' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-400'}`}>
                                    {t.status === 'done' ? '✓' : '○'}
                                  </span>
                                  <span className="text-xs text-text-primary truncate">{t.title}</span>
                                  {t.hours != null && <span className="text-xs text-text-secondary shrink-0">{t.hours}ω</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Expenses section */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Έξοδα ({expenses.length})
            </h3>
            <button
              onClick={() => setShowNewExpense(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/15 text-xs text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Νέο Έξοδο
            </button>
          </div>

          {showNewExpense && (
            <NewExpenseForm
              tenantId={tenantId}
              caseId={caseId}
              folderId={folderId}
              onSaved={() => { setShowNewExpense(false); reload(); }}
              onCancel={() => setShowNewExpense(false)}
            />
          )}

          {expenses.length === 0 && !showNewExpense ? (
            <div className="flex flex-col items-center gap-2 py-6 text-text-secondary">
              <p className="text-sm">Δεν υπάρχουν έξοδα.</p>
            </div>
          ) : expenses.length > 0 ? (
            <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-3 px-4 py-3 bg-secondary-background hover:bg-white/2 transition-colors">
                  <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-red-500">{formatEur(exp.amount)}</span>
                    {exp.date && <span className="text-xs text-text-secondary">{formatDate(exp.date)}</span>}
                    {exp.notes && <span className="text-xs text-text-secondary truncate">{exp.notes}</span>}
                    {exp.drive_file_url && (
                      <a
                        href={exp.drive_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={exp.drive_file_name ?? undefined}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-border/10 text-text-secondary hover:text-primary text-xs max-w-40 truncate"
                      >
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{exp.drive_file_name ?? 'Παραστατικό'}</span>
                      </a>
                    )}
                  </div>
                  <button onClick={() => handleDeleteExpense(exp)} className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Shared expense receipts folder */}
          <ExpenseFilesPanel folderId={folderId} caseId={caseId} />
        </div>

        {/* RIGHT — Tasks with rates widget */}
        <div className="rounded-xl border border-border/10 bg-secondary-background overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/10">
            <Clock className="h-4 w-4 text-blue-400 shrink-0" />
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex-1">
              Χρεώσιμες Εργασίες
            </h3>
            {totalTaskHours > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">
                {totalTaskHours}ω
                {totalTaskAmount != null && <span className="text-blue-300">· {formatEur(totalTaskAmount)}</span>}
              </span>
            )}
          </div>
          {tasksWithHours.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
              <Clock className="h-8 w-8 opacity-20" />
              <p className="text-sm">Δεν υπάρχουν εργασίες με ώρες.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/10">
              {tasksWithHours.map(t => {
                const amt = calcTaskAmount(t.hours, rates, t.category);
                const isDone = t.status === 'done';
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                    <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                      ${isDone ? 'border-green-500 bg-green-500' : 'border-border/40'}`}>
                      {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isDone ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {t.category && (
                          <span className="text-xs text-text-secondary">{TASK_CATEGORIES[t.category]}</span>
                        )}
                        {t.due_date && (
                          <span className="text-xs text-text-secondary">{formatDate(t.due_date)}</span>
                        )}
                        {t.fee_id && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Συνδεδεμένη</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-lg font-bold text-blue-400">{t.hours}ω</span>
                      {amt != null && (
                        <span className="text-sm text-blue-300 font-semibold">{formatEur(amt)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tasksWithHours.length > 0 && totalTaskAmount != null && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/10 bg-blue-500/5">
              <span className="text-xs text-text-secondary">Σύνολο</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-blue-400">{totalTaskHours}ω</span>
                <span className="text-sm font-semibold text-blue-300">{formatEur(totalTaskAmount)}</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function NewExpenseForm({ tenantId, caseId, onSaved, onCancel }: {
  tenantId: string; caseId: string; folderId: string | null; onSaved: () => void; onCancel: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await createCaseExpense(tenantId, caseId, {
        amount: Number(amount),
        date: date || null,
        notes: notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">Νέο Έξοδο</h4>
        <button onClick={onCancel} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/8 text-text-secondary cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Ποσό (€)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="input w-full text-sm rounded-xl" />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Ημερομηνία</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Περιγραφή εξόδου…" className="input w-full text-sm rounded-xl" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-white/5 cursor-pointer">Ακύρωση</button>
        <button onClick={handleSave} disabled={saving || !amount || Number(amount) <= 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 cursor-pointer disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" />
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
  );
}

type ExpenseDriveFile = { id: string; name: string; size?: number; modifiedTime: string; webViewLink: string };

function ExpenseFilesPanel({ folderId, caseId }: { folderId: string | null; caseId: string }) {
  const [subfolderId, setSubfolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<ExpenseDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    findOrCreateSubfolder(folderId, EXPENSES_SUBFOLDER)
      .then(async (subfolder) => {
        if (!subfolder.ok || !subfolder.folder?.id) {
          setError(subfolder.error ?? 'Αποτυχία εύρεσης υποφακέλου «Έξοδα».');
          return;
        }
        setSubfolderId(subfolder.folder.id);
        const data = await callDriveSync({ action: 'list-files', folderId: subfolder.folder.id });
        if (data.ok) setFiles(data.files);
      })
      .finally(() => setLoading(false));
  }, [folderId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0 || !subfolderId) return;
    if (inputRef.current) inputRef.current.value = '';
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? '';
    setUploadProgress({ done: 0, total: selected.length });
    let done = 0;
    for (const file of selected) {
      const data = await uploadFileToDrive(file, subfolderId, caseId, accessToken);
      if (data.ok && data.file) setFiles(prev => [data.file, ...prev]);
      done += 1;
      setUploadProgress({ done, total: selected.length });
    }
    setUploadProgress(null);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Διαγραφή παραστατικού;')) return;
    setDeletingId(fileId);
    try {
      await callDriveSync({ action: 'delete-file', fileId });
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } finally {
      setDeletingId(null);
    }
  };

  if (!folderId) return null;

  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Παραστατικά Εξόδων ({files.length})
        </h3>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!subfolderId || !!uploadProgress}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/15 text-xs text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer disabled:opacity-50"
        >
          {uploadProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Ανέβασμα αρχείων
        </button>
      </div>

      {uploadProgress && (
        <div className="px-4 py-2 border-b border-border/10">
          <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
            <span>Μεταφόρτωση…</span>
            <span>{uploadProgress.done}/{uploadProgress.total}</span>
          </div>
          <div className="h-1.5 w-full bg-border/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger px-4 py-2">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary px-4 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση…
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-text-secondary px-4 py-4">Δεν υπάρχουν παραστατικά.</p>
      ) : (
        <div className="divide-y divide-border/10">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="h-4 w-4 text-text-secondary shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{file.name}</span>
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                className="p-1.5 text-text-secondary hover:text-primary rounded transition-colors" title="Άνοιγμα">
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={() => handleDelete(file.id)}
                disabled={deletingId === file.id}
                className="p-1.5 text-text-secondary hover:text-danger rounded transition-colors disabled:opacity-50 cursor-pointer"
                title="Διαγραφή"
              >
                {deletingId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewFeeForm({ tenantId, caseId, onSaved, onCancel }: {
  tenantId: string; caseId: string; onSaved: () => void; onCancel: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [agreementDate, setAgreementDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await createCaseFee(tenantId, caseId, {
        amount: Number(amount),
        agreement_date: agreementDate || null,
        notes: notes || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">Νέα Συμφωνία Αμοιβής</h4>
        <button onClick={onCancel} className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/8 text-text-secondary cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Αμοιβή (€)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="input w-full text-sm rounded-xl" />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Ημ. Συμφωνίας</label>
          <input type="date" value={agreementDate} onChange={e => setAgreementDate(e.target.value)} className="input text-sm rounded-xl" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Προαιρετικά…" className="input w-full text-sm rounded-xl" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-white/5 cursor-pointer">Ακύρωση</button>
        <button onClick={handleSave} disabled={saving || !amount || Number(amount) <= 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 cursor-pointer disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" />
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
  );
}

function AddPaymentForm({ tenantId, feeId, onSaved, onCancel }: {
  tenantId: string; feeId: string; onSaved: () => void; onCancel: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await createFeePayment(tenantId, feeId, { amount: Number(amount), paid_at: paidAt, notes: notes || undefined });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
      setSaving(false);
    }
  };

  return (
    <div className="mx-4 mb-3 rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
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
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-white/5 cursor-pointer">Ακύρωση</button>
        <button onClick={handleSave} disabled={saving || !amount || Number(amount) <= 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-500 cursor-pointer disabled:opacity-50">
          <Plus className="h-3 w-3" />
          {saving ? 'Αποθήκευση…' : 'Προσθήκη Πληρωμής'}
        </button>
      </div>
    </div>
  );
}

function PaymentRow({ payment, onDelete }: { payment: FeePayment; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 px-10 py-2.5 hover:bg-white/2 transition-colors">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-sm font-semibold text-green-500">{formatEur(payment.amount)}</span>
        <span className="text-xs text-text-secondary">{formatDate(payment.paid_at)}</span>
        {payment.notes && <span className="text-xs text-text-secondary truncate">{payment.notes}</span>}
      </div>
      <button onClick={() => onDelete(payment.id)} className="p-1 rounded hover:bg-danger/10 text-text-secondary hover:text-danger cursor-pointer shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SummaryCard({ icon, iconBg, iconColor, label, value, valueColor }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; valueColor: string;
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
