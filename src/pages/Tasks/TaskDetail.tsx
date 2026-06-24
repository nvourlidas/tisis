import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Clock, Tag, CalendarDays, Briefcase, User,
  Link2, Pencil, RotateCcw, AlertCircle, X, Plus, Search,
} from 'lucide-react';
import { useAuth } from '../../auth';
import { formatDate } from '../../lib/dateUtils';
import {
  fetchTask, fetchLinkedTasks, completeTask, reopenTask, updateTask, updateTaskHours,
  addTaskLink, removeTaskLink, searchFullTasks, createTask,
  fetchCategoryRates, calcTaskAmount,
  TASK_CATEGORIES,
  type Task, type LinkedTask, type LegalActData, type AppointmentData, type CourtData, type TaskCategory, type CategoryRate,
} from './taskUtils';

import TaskForm, { taskToFormValues, type TaskFormValues } from './TaskForm';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [task, setTask] = useState<Task | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [rates, setRates] = useState<CategoryRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateLinked, setShowCreateLinked] = useState(false);
  const [creatingLinked, setCreatingLinked] = useState(false);
  const [createLinkedError, setCreateLinkedError] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  const handleAddLink = async (target: Task) => {
    if (!id) return;
    await addTaskLink(tenantId, id, target.id);
    setShowLinkModal(false);
    const links = await fetchLinkedTasks(id);
    setLinkedTasks(links);
  };

  const handleCreateLinked = async (values: TaskFormValues) => {
    if (!id) return;
    setCreatingLinked(true);
    setCreateLinkedError(null);
    try {
      const newTask = await createTask(tenantId, {
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        due_time: values.due_time || undefined,
        case_id: values.case_id || '',
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
      });
      await addTaskLink(tenantId, id, newTask.id);
      setShowCreateLinked(false);
      const links = await fetchLinkedTasks(id);
      setLinkedTasks(links);
    } catch (e: any) {
      setCreateLinkedError(e?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setCreatingLinked(false);
    }
  };

  const handleRemoveLink = async (linkedTaskId: string) => {
    if (!id) return;
    await removeTaskLink(id, linkedTaskId);
    const links = await fetchLinkedTasks(id);
    setLinkedTasks(links);
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [t, links] = await Promise.all([fetchTask(id), fetchLinkedTasks(id)]);
    setTask(t);
    setLinkedTasks(links);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tenantId) fetchCategoryRates(tenantId).then(setRates).catch(() => {}); }, [tenantId]);

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
        due_time: values.due_time || undefined,
        case_id: values.case_id || null,
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
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
  const appointment = task.category === 'appointment'
    ? (task.extra_data as AppointmentData | null) : null;
  const courtData = task.category === 'court'
    ? (task.extra_data as CourtData | null) : null;
  const calculatedAmount = calcTaskAmount(task.hours, rates, task.category);

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
              value={task.due_time ? `${formatDate(task.due_date)} ${task.due_time}` : formatDate(task.due_date)}
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

      {/* Appointment details */}
      {appointment && (appointment.start_datetime || appointment.end_datetime) && (
        <Section title="Στοιχεία Ραντεβού">
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

      {/* Court details */}
      {courtData && (courtData.start_datetime || courtData.end_datetime || courtData.decision_number || courtData.decision_date) && (
        <Section title="Στοιχεία Δικαστηρίου">
          <div className="grid grid-cols-2 gap-4">
            {courtData.start_datetime && (
              <Field label="Έναρξη" value={new Date(courtData.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            )}
            {courtData.end_datetime && (
              <Field label="Λήξη" value={new Date(courtData.end_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
            )}
            {courtData.decision_number && (
              <Field label="Αριθμός Απόφασης" value={courtData.decision_number} />
            )}
            {courtData.decision_date && (
              <Field label="Ημερομηνία Έκδοσης" value={new Date(courtData.decision_date + 'T00:00:00').toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
            )}
          </div>
        </Section>
      )}

      {/* Hours widget */}
      <HoursWidget
        task={task}
        rates={rates}
        calculatedAmount={calculatedAmount}
        editingHours={editingHours}
        hoursInput={hoursInput}
        savingHours={savingHours}
        onStartEdit={() => { setHoursInput(task.hours != null ? String(task.hours) : ''); setEditingHours(true); }}
        onCancel={() => setEditingHours(false)}
        onSave={async () => {
          const val = hoursInput === '' ? null : parseFloat(hoursInput);
          if (val !== null && isNaN(val)) return;
          setSavingHours(true);
          try {
            await updateTaskHours(task.id, val);
            setEditingHours(false);
            await load();
          } finally {
            setSavingHours(false);
          }
        }}
        onChangeInput={setHoursInput}
      />

      {/* Linked tasks */}
      <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Συνδεδεμένες Εργασίες
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCreateLinked(true); setCreateLinkedError(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Νέα
            </button>
            <button
              onClick={() => setShowLinkModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Σύνδεση
            </button>
          </div>
        </div>

        {linkedTasks.length === 0 ? (
          <p className="text-sm text-text-secondary">Δεν υπάρχουν συνδεδεμένες εργασίες.</p>
        ) : (
          <div className="space-y-2">
            {linkedTasks.map(t => (
              <LinkedTaskRow key={t.id} task={t} onClick={() => navigate(`/tasks/${t.id}`)} onUnlink={() => handleRemoveLink(t.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Link task modal */}
      {showLinkModal && (
        <LinkTaskModal
          tenantId={tenantId}
          excludeId={id}
          alreadyLinked={linkedTasks.map(t => t.id)}
          onSelect={handleAddLink}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Create linked task modal */}
      {showCreateLinked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreateLinked(false); setCreateLinkedError(null); }} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-secondary-background px-6 py-4 border-b border-border/10">
              <h2 className="text-sm font-semibold text-text-primary">Νέα Συνδεδεμένη Εργασία</h2>
              <button onClick={() => { setShowCreateLinked(false); setCreateLinkedError(null); }} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <TaskForm
                tenantId={tenantId}
                initial={{ case_id: task.case_id ?? '', case_code: task.case_code ?? undefined, case_title: task.case_title ?? undefined, case_client_name: task.client_name ?? undefined, due_date: new Date().toISOString().slice(0, 10) }}
                saving={creatingLinked}
                error={createLinkedError}
                onSubmit={handleCreateLinked}
                onCancel={() => { setShowCreateLinked(false); setCreateLinkedError(null); }}
                submitLabel="Δημιουργία"
                hideLinkedTasks
              />
            </div>
          </div>
        </div>
      )}

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
                initial={{ ...taskToFormValues({ ...task, linked_tasks: linkedTasks }), id: task.id, case_code: task.case_code ?? undefined, case_title: task.case_title ?? undefined, case_client_name: task.client_name ?? undefined }}
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

// ── Hours Widget ─────────────────────────────────────────────────────────────

function HoursWidget({ task, rates, calculatedAmount, editingHours, hoursInput, savingHours, onStartEdit, onCancel, onSave, onChangeInput }: {
  task: Task;
  rates: CategoryRate[];
  calculatedAmount: number | null;
  editingHours: boolean;
  hoursInput: string;
  savingHours: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChangeInput: (v: string) => void;
}) {
  const rateForCategory = task.category ? rates.find(r => r.category === task.category) : null;
  const hasRate = !!rateForCategory && rateForCategory.rate_per_hour > 0;
  const fmt = (n: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n);
  const previewAmount = editingHours && hoursInput !== ''
    ? calcTaskAmount(parseFloat(hoursInput), rates, task.category)
    : null;

  return (
    <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Χρεώσιμες Ώρες
        </h2>
        {!editingHours && (
          <button
            onClick={onStartEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            Επεξεργασία
          </button>
        )}
      </div>

      {editingHours ? (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="w-36">
              <label className="block text-xs text-text-secondary mb-1">Ώρες</label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.25"
                placeholder="0"
                value={hoursInput}
                onChange={e => onChangeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border/20 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {previewAmount != null && (
              <div className="pb-2">
                <p className="text-xs text-text-secondary mb-0.5">Υπολογισμένο</p>
                <p className="text-sm font-semibold text-blue-500">{fmt(previewAmount)}</p>
              </div>
            )}
            {hoursInput && !previewAmount && !hasRate && (
              <p className="text-xs text-text-secondary pb-2">Δεν έχει οριστεί χρέωση για αυτή την κατηγορία.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={savingHours}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingHours ? '...' : 'Αποθήκευση'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border/20 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Ακύρωση
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6 text-sm">
          {task.hours != null && task.hours > 0 ? (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Ώρες</p>
                <p className="font-semibold text-text-primary">{task.hours}</p>
              </div>
              {calculatedAmount != null && (
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">Υπολογισμένο ποσό</p>
                  <p className="font-semibold text-blue-500">{fmt(calculatedAmount)}</p>
                </div>
              )}
              {!hasRate && task.category && (
                <p className="text-xs text-text-secondary self-end pb-0.5">Δεν έχει οριστεί χρέωση για αυτή την κατηγορία.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-text-secondary">Δεν έχουν καταχωρηθεί ώρες.</p>
          )}
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

function LinkedTaskRow({ task, onClick, onUnlink }: { task: LinkedTask; onClick: () => void; onUnlink?: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.status === 'open' && !!task.due_date && task.due_date < today;
  const isDone = task.status === 'done';

  return (
    <div className={[
      'flex items-center gap-2 rounded-xl border group',
      isDone ? 'border-green-500/15 bg-green-500/5 opacity-70' :
      isOverdue ? 'border-orange-500/20 bg-orange-500/5' :
      'border-border/10 bg-white/2 hover:bg-white/4',
    ].join(' ')}>
    <button
      onClick={onClick}
      className="flex-1 flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:-translate-y-0.5 transition-transform"
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
    {onUnlink && (
      <button
        onClick={e => { e.stopPropagation(); onUnlink(); }}
        className="opacity-0 group-hover:opacity-100 pr-3 text-text-secondary hover:text-red-400 transition-all cursor-pointer shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
    </div>
  );
}

// ── Link task modal ───────────────────────────────────────────────────────────

const MODAL_MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

function LinkTaskModal({ tenantId, excludeId, alreadyLinked, onSelect, onClose }: {
  tenantId: string;
  excludeId: string | undefined;
  alreadyLinked: string[];
  onSelect: (task: Task) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Task[]>([]);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState<TaskCategory | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!query.trim() || !tenantId) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const all = await searchFullTasks(tenantId, query.trim());
        setResults(all);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, tenantId]);

  const filtered = results.filter(t => {
    if (t.id === excludeId) return false;
    if (alreadyLinked.includes(t.id)) return false;
    if (category && t.category !== category) return false;
    if (filterYear !== null && t.due_date) {
      if (new Date(t.due_date + 'T00:00:00').getFullYear() !== filterYear) return false;
    }
    if (filterMonth !== null && t.due_date) {
      if (new Date(t.due_date + 'T00:00:00').getMonth() !== filterMonth) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/10 shrink-0">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Σύνδεση Εργασίας
          </h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + filters */}
        <div className="px-5 py-3 space-y-3 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-border/15 bg-background px-3 py-2">
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Αναζήτηση εργασίας…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
            {searching && <RotateCcw className="h-3.5 w-3.5 animate-spin text-text-secondary shrink-0" />}
            {query && !searching && (
              <button onClick={() => setQuery('')} className="text-text-secondary hover:text-text-primary cursor-pointer shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <select
              value={category ?? ''}
              onChange={e => setCategory(e.target.value ? e.target.value as TaskCategory : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλες οι κατηγορίες</option>
              {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map(c => (
                <option key={c} value={c}>{TASK_CATEGORIES[c]}</option>
              ))}
            </select>
            <select
              value={filterYear ?? ''}
              onChange={e => setFilterYear(e.target.value ? Number(e.target.value) : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλα τα έτη</option>
              {Array.from({ length: currentYear - 1999 }, (_, i) => 2000 + i).reverse().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterMonth ?? ''}
              onChange={e => setFilterMonth(e.target.value !== '' ? Number(e.target.value) : null)}
              className="bg-background border border-border/15 rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
            >
              <option value="">Όλοι οι μήνες</option>
              {MODAL_MONTH_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {!query.trim() ? (
            <p className="text-sm text-text-secondary text-center py-8">Πληκτρολογήστε για αναζήτηση.</p>
          ) : filtered.length === 0 && !searching ? (
            <p className="text-sm text-text-secondary text-center py-8">Δεν βρέθηκαν εργασίες.</p>
          ) : (
            filtered.map(t => {
              const today = new Date().toISOString().slice(0, 10);
              const isOverdue = t.status === 'open' && !!t.due_date && t.due_date < today;
              const isDone = t.status === 'done';
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/10 bg-white/2 hover:bg-white/6 hover:border-primary/20 px-4 py-3 text-left transition-colors cursor-pointer"
                >
                  <div className={[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    isDone ? 'border-green-500 bg-green-500 text-white' :
                    isOverdue ? 'border-orange-400' : 'border-border/40',
                  ].join(' ')}>
                    {isDone && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDone ? 'text-text-secondary' : 'text-text-primary'}`}>
                      {t.title}
                    </p>
                    {t.case_code && (
                      <p className="text-xs text-primary font-mono truncate">{t.case_code}{t.case_title ? ` — ${t.case_title}` : ''}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {t.category && (
                      <span className="text-[10px] text-text-secondary">{TASK_CATEGORIES[t.category]}</span>
                    )}
                    {t.due_date && (
                      <span className={`text-[10px] ${isOverdue ? 'text-orange-400' : 'text-text-secondary'}`}>
                        {formatDate(t.due_date)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
