import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Clock, Tag, CalendarDays, Briefcase, User,
  Euro, Receipt, Link2, Pencil, RotateCcw, AlertCircle, X, Plus, Trash2,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { formatDate } from '../../lib/dateUtils';
import {
  fetchTask, fetchLinkedTasks, completeTask, reopenTask, updateTask,
  fetchTaskPayments, createTaskPayment, deleteTaskPayment,
  TASK_CATEGORIES,
  type Task, type LinkedTask, type LegalActData, type AppointmentData, type TaskPayment,
} from './taskUtils';
import TaskForm, { taskToFormValues, type TaskFormValues } from './TaskForm';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [task, setTask] = useState<Task | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [payments, setPayments] = useState<TaskPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [t, links, pays] = await Promise.all([fetchTask(id), fetchLinkedTasks(id), fetchTaskPayments(id)]);
    setTask(t);
    setLinkedTasks(links);
    setPayments(pays);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleToggle = async () => {
    if (!task) return;
    setToggling(true);
    try {
      if (task.status === 'open') await completeTask(task.id);
      else await reopenTask(task.id);
      await load();
    } finally {
      setToggling(false);
    }
  };

  const handleAddPayment = async () => {
    if (!task || !paymentAmount) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) { setPaymentError('Μη έγκυρο ποσό.'); return; }
    setAddingPayment(true);
    setPaymentError(null);
    try {
      await createTaskPayment(tenantId, task.id, { amount: amt, paid_at: paymentDate, notes: paymentNotes || undefined });
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setShowPaymentForm(false);
      const pays = await fetchTaskPayments(task.id);
      setPayments(pays);
    } catch (e: any) {
      setPaymentError(e?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setAddingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!task) return;
    await deleteTaskPayment(paymentId);
    const pays = await fetchTaskPayments(task.id);
    setPayments(pays);
  };

  const handleUpdate = async (values: TaskFormValues) => {
    if (!task) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTask({
        id: task.id,
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        case_id: values.case_id || null,
        category: values.category || undefined,
        extra_data: values.extra_data,
        fee: values.fee,
        expenses: values.expenses,
        linked_task_ids: values.linked_task_ids,
      });
      setEditing(false);
      await load();
    } catch (e: any) {
      setSaveError(e?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft">
        <RotateCcw className="h-4 w-4 animate-spin" />
        Φόρτωση εργασίας…
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Εργασίες
        </button>
        <p className="text-sm text-text-secondary">Η εργασία δεν βρέθηκε.</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.status === 'open' && !!task.due_date && task.due_date < today;
  const isDone = task.status === 'done';
  const legalAct = (task.category === 'legal_act' || task.category === 'lawsuit')
    ? (task.extra_data as LegalActData | null) : null;
  const appointment = (task.category === 'appointment' || task.category === 'court')
    ? (task.extra_data as AppointmentData | null) : null;
  const totalExpenses = task.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

      {/* Back */}
      <button onClick={() => navigate('/tasks')} className="md:col-span-2 flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors animate-fade-in">
        <ArrowLeft className="h-4 w-4" />
        Εργασίες
      </button>

      {/* Header card */}
      <div className="md:col-span-2 animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={[
                'mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer',
                isDone ? 'border-green-500 bg-green-500 text-white' :
                isOverdue ? 'border-orange-400 hover:bg-orange-400/20' :
                'border-border/40 hover:border-primary',
              ].join(' ')}
            >
              {isDone && <Check className="h-3.5 w-3.5" />}
              {!isDone && toggling && <RotateCcw className="h-3 w-3 animate-spin text-text-secondary" />}
            </button>
            <h1 className={`text-xl font-bold leading-snug ${isDone ? 'text-text-secondary' : 'text-text-primary'}`}>
              {task.title}
            </h1>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            Επεξεργασία
          </button>
        </div>

        {/* Status + category chips */}
        <div className="flex flex-wrap gap-2 pl-9">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isDone ? 'bg-green-500/10 text-green-500' :
            isOverdue ? 'bg-orange-500/10 text-orange-500' :
            'bg-primary/10 text-primary'
          }`}>
            {isDone ? <Check className="h-3 w-3" /> : isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {isDone ? 'Ολοκληρώθηκε' : isOverdue ? 'Ληξιπρόθεσμη' : 'Ανοιχτή'}
          </span>
          {task.category && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-border/10 text-text-secondary">
              <Tag className="h-3 w-3" />
              {TASK_CATEGORIES[task.category]}
            </span>
          )}
        </div>

        {/* Key info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-9">
          {task.due_date && (
            <InfoCard
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Ημερομηνία"
              value={formatDate(task.due_date)}
              color={isOverdue ? 'text-orange-500' : 'text-blue-500'}
              bg={isOverdue ? 'bg-orange-500/10' : 'bg-blue-500/10'}
            />
          )}
          {isDone && task.completed_at && (
            <InfoCard
              icon={<Check className="h-3.5 w-3.5" />}
              label="Ολοκληρώθηκε"
              value={formatDate(task.completed_at.slice(0, 10))}
              color="text-green-500"
              bg="bg-green-500/10"
            />
          )}
          {task.case_code && (
            <button
              onClick={() => task.case_id && navigate(`/cases/${task.case_id}`)}
              className="flex items-center gap-2.5 rounded-xl border border-border/10 bg-secondary-background p-3 hover:border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                <Briefcase className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-text-secondary uppercase tracking-wider">Υπόθεση</div>
                <div className="text-xs font-mono text-primary truncate">{task.case_code}</div>
                {task.case_title && <div className="text-xs text-text-primary truncate">{task.case_title}</div>}
              </div>
            </button>
          )}
          {task.client_name && (
            <InfoCard
              icon={<User className="h-3.5 w-3.5" />}
              label="Εντολέας"
              value={task.client_name}
              color="text-teal-500"
              bg="bg-teal-500/10"
            />
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="pl-9 rounded-xl border border-border/10 bg-background p-4">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Περιγραφή</div>
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{task.description}</p>
          </div>
        )}
      </div>

      {/* Legal Act / Lawsuit details */}
      {legalAct && (
        <Section title={task.category === 'lawsuit' ? 'Στοιχεία Αγωγής/Αίτησης/Προσφυγής' : 'Στοιχεία Νομικής Πράξης'}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {task.category === 'legal_act' && <Field label="Αρ. Πρωτοκόλου" value={legalAct.protocol_number} />}
            <Field label="Ημ. Κατάθεσης" value={legalAct.creation_date ? formatDate(legalAct.creation_date) : undefined} />
            <Field label={task.category === 'lawsuit' ? 'Αρμόδιο Δικαστήριο' : 'Αρμόδια Αρχή'} value={legalAct.authority} />
            {task.category === 'lawsuit' && <Field label="ΓΑΚ" value={legalAct.gak} />}
            {task.category === 'lawsuit' && <Field label="ΕΑΚ" value={legalAct.eak} />}
          </div>
          {legalAct.decision && (legalAct.decision.number || legalAct.decision.date || legalAct.decision.description) && (
            <div className="pt-3 border-t border-border/10 space-y-3">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Απόφαση</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Αριθμός" value={legalAct.decision.number} />
                <Field label="Ημερομηνία" value={legalAct.decision.date ? formatDate(legalAct.decision.date) : undefined} />
              </div>
              {legalAct.decision.description && <Field label="Περιγραφή" value={legalAct.decision.description} />}
            </div>
          )}
        </Section>
      )}

      {/* Appointment / Court details */}
      {appointment && (appointment.start_datetime || appointment.end_datetime) && (
        <Section title={task.category === 'court' ? 'Στοιχεία Δικαστηρίου' : 'Στοιχεία Ραντεβού'}>
          <div className="grid grid-cols-2 gap-4">
            {appointment.start_datetime && (
              <Field label="Έναρξη" value={new Date(appointment.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            )}
            {appointment.end_datetime && (
              <Field label="Λήξη" value={new Date(appointment.end_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            )}
          </div>
        </Section>
      )}

      {/* Financials */}
      {(task.fee || (task.expenses?.length ?? 0) > 0) && (
        <Section title="Οικονομικά">
          <div className="space-y-3">
            {task.fee != null && task.fee > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Euro className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-text-secondary">Αμοιβή:</span>
                <span className="font-semibold text-green-500">{task.fee.toFixed(2)} €</span>
              </div>
            )}
            {(task.expenses?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-text-secondary">Έξοδα:</span>
                  <span className="font-semibold text-red-400">{totalExpenses.toFixed(2)} €</span>
                </div>
                <div className="pl-6 space-y-1">
                  {task.expenses!.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{e.description}</span>
                      <span className="font-medium">{e.amount.toFixed(2)} €</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Payments */}
      {task.fee != null && task.fee > 0 && (
        <Section title="Πληρωμές" icon={<Euro className="h-4 w-4" />}>
          {(() => {
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            const remaining = task.fee - totalPaid;
            return (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text-secondary">Σύνολο: <strong className="text-text-primary">{task.fee.toFixed(2)} €</strong></span>
                  <span className="text-green-500">Πληρωμένο: <strong>{totalPaid.toFixed(2)} €</strong></span>
                  <span className={remaining > 0 ? 'text-orange-400' : 'text-green-500'}>
                    Υπόλοιπο: <strong>{remaining.toFixed(2)} €</strong>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-border/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.min(100, (totalPaid / task.fee) * 100)}%` }}
                  />
                </div>
                {/* Payment list */}
                {payments.length > 0 && (
                  <div className="space-y-1">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 bg-white/3 hover:bg-white/5 group">
                        <span className="text-xs text-text-secondary w-24 shrink-0">{p.paid_at}</span>
                        <span className="text-sm font-semibold text-green-500 w-20 shrink-0">{p.amount.toFixed(2)} €</span>
                        <span className="text-xs text-text-secondary flex-1 truncate">{p.notes ?? ''}</span>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add payment form */}
                {showPaymentForm ? (
                  <div className="space-y-3 rounded-xl border border-border/20 bg-white/3 p-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Ποσό (€)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={paymentAmount}
                          onChange={e => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/40"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Ημερομηνία</label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={e => setPaymentDate(e.target.value)}
                          className="w-full rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary uppercase tracking-wider mb-1 block">Σημειώσεις</label>
                      <input
                        type="text"
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        placeholder="Προαιρετικό"
                        className="w-full rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/40"
                      />
                    </div>
                    {paymentError && <p className="text-xs text-red-400">{paymentError}</p>}
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setShowPaymentForm(false); setPaymentError(null); }} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary cursor-pointer">Άκυρο</button>
                      <button
                        onClick={handleAddPayment}
                        disabled={addingPayment}
                        className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                      >
                        {addingPayment ? 'Αποθήκευση…' : 'Αποθήκευση'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Προσθήκη Πληρωμής
                  </button>
                )}
              </div>
            );
          })()}
        </Section>
      )}

      {/* Linked tasks */}
      <Section title="Συνδεδεμένες Εργασίες" icon={<Link2 className="h-4 w-4" />}>
        {linkedTasks.length === 0 ? (
          <p className="text-sm text-text-secondary">Δεν υπάρχουν συνδεδεμένες εργασίες.</p>
        ) : (
          <div className="space-y-2">
            {linkedTasks.map(t => (
              <LinkedTaskRow key={t.id} task={t} onClick={() => navigate(`/tasks/${t.id}`)} />
            ))}
          </div>
        )}
      </Section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setEditing(false); setSaveError(null); }} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-secondary-background px-6 py-4 border-b border-border/10">
              <h2 className="text-sm font-semibold text-text-primary">Επεξεργασία Εργασίας</h2>
              <button onClick={() => { setEditing(false); setSaveError(null); }} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <TaskForm
                tenantId={tenantId}
                initial={{ ...taskToFormValues({ ...task, linked_tasks: linkedTasks }), id: task.id, case_code: task.case_code ?? undefined, case_title: task.case_title ?? undefined }}
                saving={saving}
                error={saveError}
                onSubmit={handleUpdate}
                onCancel={() => { setEditing(false); setSaveError(null); }}
                submitLabel="Αποθήκευση"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}

function InfoCard({ icon, label, value, color = 'text-text-secondary', bg = 'bg-border/5' }: {
  icon: React.ReactNode; label: string; value: string; color?: string; bg?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/10 bg-secondary-background p-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bg} ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-text-primary truncate">{value}</div>
      </div>
    </div>
  );
}

function LinkedTaskRow({ task, onClick }: { task: LinkedTask; onClick: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.status === 'open' && !!task.due_date && task.due_date < today;
  const isDone = task.status === 'done';

  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer hover:-translate-y-0.5 transition-transform',
        isDone ? 'border-green-500/15 bg-green-500/5 opacity-70' :
        isOverdue ? 'border-orange-500/20 bg-orange-500/5' :
        'border-border/10 bg-white/2 hover:bg-white/4',
      ].join(' ')}
    >
      <div className={[
        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
        isDone ? 'border-green-500 bg-green-500 text-white' :
        isOverdue ? 'border-orange-400' : 'border-border/40',
      ].join(' ')}>
        {isDone && <Check className="h-2.5 w-2.5" />}
      </div>
      <span className={`flex-1 text-sm font-medium truncate ${isDone ? 'text-text-secondary' : 'text-text-primary'}`}>
        {task.title}
      </span>
      {task.category && (
        <span className="text-[10px] text-text-secondary shrink-0">{TASK_CATEGORIES[task.category]}</span>
      )}
      {task.due_date && (
        <span className={`text-[10px] shrink-0 ${isOverdue ? 'text-orange-400' : 'text-text-secondary'}`}>
          {formatDate(task.due_date)}
        </span>
      )}
    </button>
  );
}
