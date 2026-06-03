import { useEffect, useState } from 'react';
import { Search, X, Plus, Trash2, Link2 } from 'lucide-react';
import { searchCasesForCall } from '../Calls/callUtils';
import {
  TASK_CATEGORIES, searchTasks, fetchLinkedTasks, createTask,
  type TaskCategory, type LegalActData, type AppointmentData, type CourtData, type Task, type TaskExpense, type LinkedTask,
} from './taskUtils';

export type TaskFormValues = {
  title: string;
  description: string;
  due_date: string;
  due_time: string;
  case_id: string;
  category: TaskCategory | '';
  extra_data: LegalActData | AppointmentData | null;
  fee: number | null;
  expenses: TaskExpense[];
  linked_task_ids: string[];
};

type Props = {
  tenantId: string;
  initial?: Partial<TaskFormValues> & { id?: string; case_code?: string; case_title?: string };
  hideCaseField?: boolean;
  hideLinkedTasks?: boolean;
  saving: boolean;
  error: string | null;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  submitLabel?: string;
};

const emptyLegalAct = (): LegalActData => ({
  protocol_number: '', creation_date: '', authority: '', gak: '', eak: '',
  decision: { number: '', date: '', description: '' },
});
const emptyAppointment = (): AppointmentData => ({ start_datetime: '', end_datetime: '' });
const emptyCourt = (): CourtData => ({ start_datetime: '', end_datetime: '', decision_number: '', decision_date: '' });

function legalActFromData(d: LegalActData | null | undefined): LegalActData {
  return {
    protocol_number: d?.protocol_number ?? '',
    creation_date: d?.creation_date ?? '',
    authority: d?.authority ?? '',
    gak: d?.gak ?? '',
    eak: d?.eak ?? '',
    decision: {
      number: d?.decision?.number ?? '',
      date: d?.decision?.date ?? '',
      description: d?.decision?.description ?? '',
    },
  };
}

function appointmentFromData(d: AppointmentData | null | undefined): AppointmentData {
  return { start_datetime: d?.start_datetime ?? '', end_datetime: d?.end_datetime ?? '' };
}

function courtFromData(d: CourtData | null | undefined): CourtData {
  return {
    start_datetime: d?.start_datetime ?? '',
    end_datetime: d?.end_datetime ?? '',
    decision_number: d?.decision_number ?? '',
    decision_date: d?.decision_date ?? '',
  };
}

export function buildExtraData(category: TaskCategory | '', legalAct: LegalActData, appointment: AppointmentData, court: CourtData): LegalActData | AppointmentData | CourtData | null {
  if (category === 'legal_act' || category === 'lawsuit') {
    const d: LegalActData = {};
    if (category === 'legal_act' && legalAct.protocol_number) d.protocol_number = legalAct.protocol_number;
    if (legalAct.creation_date) d.creation_date = legalAct.creation_date;
    if (legalAct.authority) d.authority = legalAct.authority;
    if (legalAct.gak) d.gak = legalAct.gak;
    if (legalAct.eak) d.eak = legalAct.eak;
    const dec = legalAct.decision ?? {};
    if (dec.number || dec.date || dec.description) {
      d.decision = {};
      if (dec.number) d.decision.number = dec.number;
      if (dec.date) d.decision.date = dec.date;
      if (dec.description) d.decision.description = dec.description;
    }
    return Object.keys(d).length ? d : null;
  }
  if (category === 'court') {
    const d: CourtData = {};
    if (court.start_datetime) d.start_datetime = court.start_datetime;
    if (court.end_datetime) d.end_datetime = court.end_datetime;
    if (court.decision_number) d.decision_number = court.decision_number;
    if (court.decision_date) d.decision_date = court.decision_date;
    return Object.keys(d).length ? d : null;
  }
  if (category === 'appointment') {
    const d: AppointmentData = {};
    if (appointment.start_datetime) d.start_datetime = appointment.start_datetime;
    if (appointment.end_datetime) d.end_datetime = appointment.end_datetime;
    return Object.keys(d).length ? d : null;
  }
  return null;
}

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    due_date: task.due_date ?? '',
    due_time: task.due_time ?? '',
    case_id: task.case_id ?? '',
    category: task.category ?? '',
    extra_data: task.extra_data ?? null,
    fee: task.fee ?? null,
    expenses: task.expenses ?? [],
    linked_task_ids: task.linked_tasks?.map(t => t.id) ?? [],
  };
}

export default function TaskForm({ tenantId, initial, hideCaseField, hideLinkedTasks, saving, error, onSubmit, onCancel, submitLabel = 'Δημιουργία' }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [due_date, setDueDate] = useState(initial?.due_date ?? '');
  const [due_time, setDueTime] = useState(initial?.due_time ?? '');
  const [case_id, setCaseId] = useState(initial?.case_id ?? '');
  const [category, setCategory] = useState<TaskCategory | ''>(initial?.category ?? '');

  const initExtra = initial?.extra_data;
  const [legalAct, setLegalAct] = useState<LegalActData>(
    (initial?.category === 'legal_act' || initial?.category === 'lawsuit') ? legalActFromData(initExtra as LegalActData) : emptyLegalAct()
  );
  const [appointment, setAppointment] = useState<AppointmentData>(
    initial?.category === 'appointment' ? appointmentFromData(initExtra as AppointmentData) : emptyAppointment()
  );
  const [court, setCourt] = useState<CourtData>(
    initial?.category === 'court' ? courtFromData(initExtra as CourtData) : emptyCourt()
  );

  const [fee, setFee] = useState<string>(initial?.fee != null ? String(initial.fee) : '');
  const [expenses, setExpenses] = useState<TaskExpense[]>(initial?.expenses ?? []);

  // Linked tasks
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [taskQuery, setTaskQuery] = useState('');
  const [taskOptions, setTaskOptions] = useState<LinkedTask[]>([]);
  const [searchingTasks, setSearchingTasks] = useState(false);
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  const addExpense = () => setExpenses(ex => [...ex, { description: '', amount: 0 }]);
  const removeExpense = (i: number) => setExpenses(ex => ex.filter((_, idx) => idx !== i));
  const setExpenseField = (i: number, k: keyof TaskExpense, v: string) =>
    setExpenses(ex => ex.map((e, idx) => idx === i ? { ...e, [k]: k === 'amount' ? parseFloat(v) || 0 : v } : e));

  const [selectedCase, setSelectedCase] = useState<{ id: string; code: string; title: string } | null>(
    initial?.case_id && initial.case_code ? { id: initial.case_id, code: initial.case_code, title: initial.case_title ?? '' } : null
  );
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<{ id: string; code: string; title: string }[]>([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [showCaseSearch, setShowCaseSearch] = useState(false);

  useEffect(() => {
    if (!caseQuery.trim() || !tenantId) { setCaseOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingCases(true);
      const results = await searchCasesForCall(tenantId, caseQuery.trim());
      setCaseOptions(results);
      setSearchingCases(false);
    }, 250);
    return () => clearTimeout(t);
  }, [caseQuery, tenantId]);

  // Load existing linked tasks when editing
  useEffect(() => {
    if (!initial?.id) return;
    fetchLinkedTasks(initial.id).then(setLinkedTasks).catch(() => {});
  }, [initial?.id]);

  // Task search
  useEffect(() => {
    if (!taskQuery.trim() || !tenantId) { setTaskOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingTasks(true);
      const excludeId = initial?.id;
      const results = await searchTasks(tenantId, taskQuery.trim(), excludeId);
      setTaskOptions(results.filter(r => !linkedTasks.some(lt => lt.id === r.id)));
      setSearchingTasks(false);
    }, 250);
    return () => clearTimeout(t);
  }, [taskQuery, tenantId, linkedTasks]);

  const selectCase = (c: { id: string; code: string; title: string }) => {
    setSelectedCase(c);
    setCaseId(c.id);
    setShowCaseSearch(false);
    setCaseQuery('');
    setCaseOptions([]);
  };

  const clearCase = () => { setSelectedCase(null); setCaseId(''); };

  const setLA = (k: keyof LegalActData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLegalAct(f => ({ ...f, [k]: e.target.value }));
  const setDecision = (k: keyof NonNullable<LegalActData['decision']>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLegalAct(f => ({ ...f, decision: { ...f.decision, [k]: e.target.value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title, description, due_date, due_time, case_id, category,
      extra_data: buildExtraData(category, legalAct, appointment, court),
      fee: fee !== '' ? parseFloat(fee) : null,
      expenses: expenses.filter(e => e.description.trim() || e.amount),
      linked_task_ids: linkedTasks.map(t => t.id),
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Τίτλος <span className="text-danger">*</span></label>
          <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Κατηγορία</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCategory('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${!category ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
              Καμία
            </button>
            {(Object.keys(TASK_CATEGORIES) as TaskCategory[]).map(cat => (
              <button key={cat} type="button" onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${category === cat ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
                {TASK_CATEGORIES[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${!hideCaseField ? 'sm:grid-cols-2' : ''}`}>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Ημερομηνία</label>
              <input type="date" className="input w-full" value={due_date} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="w-32">
              <label className="block text-xs text-text-secondary mb-1">Ώρα</label>
              <input type="time" className="input w-full" value={due_time} onChange={e => setDueTime(e.target.value)} />
            </div>
          </div>
          {!hideCaseField && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Υπόθεση</label>
              {selectedCase ? (
                <div className="flex items-center gap-2 input">
                  <span className="font-mono text-xs text-text-secondary">{selectedCase.code}</span>
                  <span className="text-sm text-text-primary flex-1 truncate">{selectedCase.title}</span>
                  <button type="button" onClick={clearCase} className="text-text-secondary hover:text-danger cursor-pointer shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  {!showCaseSearch ? (
                    <button type="button" onClick={() => setShowCaseSearch(true)}
                      className="w-full flex items-center gap-2 input text-text-secondary hover:text-text-primary cursor-pointer">
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm">Επιλογή υπόθεσης</span>
                    </button>
                  ) : (
                    <input className="input w-full" placeholder="Αναζήτηση…" value={caseQuery}
                      onChange={e => setCaseQuery(e.target.value)} autoFocus
                      onBlur={() => { if (!caseQuery.trim()) setShowCaseSearch(false); }} />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {showCaseSearch && caseOptions.length > 0 && (
          <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10 -mt-2">
            {searchingCases && <p className="px-3 py-2 text-xs text-text-secondary">Αναζήτηση…</p>}
            {caseOptions.map(c => (
              <button key={c.id} type="button" onClick={() => selectCase(c)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors text-left">
                <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
                <span className="text-sm text-text-primary truncate">{c.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Extra fields: Νομικές Πράξεις / Αγωγή */}
        {(category === 'legal_act' || category === 'lawsuit') && (
          <div className="space-y-3 rounded-xl border border-border/10 p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {category === 'lawsuit' ? 'Στοιχεία Αγωγής/Αίτησης/Προσφυγής' : 'Στοιχεία Νομικής Πράξης'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {category === 'legal_act' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Αριθμός Πρωτοκόλου</label>
                  <input className="input w-full text-sm" value={legalAct.protocol_number ?? ''} onChange={setLA('protocol_number')} />
                </div>
              )}
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ημ. Κατάθεσης</label>
                <input type="date" className="input w-full text-sm" value={legalAct.creation_date ?? ''} onChange={setLA('creation_date')} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">{category === 'lawsuit' ? 'Αρμόδιο Δικαστήριο' : 'Αρμόδια Αρχή'}</label>
                <input className="input w-full text-sm" value={legalAct.authority ?? ''} onChange={setLA('authority')} />
              </div>
              {category === 'lawsuit' && (<>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">ΓΑΚ</label>
                  <input className="input w-full text-sm" value={legalAct.gak ?? ''} onChange={setLA('gak')} />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">ΕΑΚ</label>
                  <input className="input w-full text-sm" value={legalAct.eak ?? ''} onChange={setLA('eak')} />
                </div>
              </>)}
            </div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-2">Απόφαση</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Αριθμός</label>
                <input className="input w-full text-sm" value={legalAct.decision?.number ?? ''} onChange={setDecision('number')} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ημερομηνία</label>
                <input type="date" className="input w-full text-sm" value={legalAct.decision?.date ?? ''} onChange={setDecision('date')} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
                <textarea className="input w-full resize-none text-sm" rows={2} value={legalAct.decision?.description ?? ''} onChange={setDecision('description')} />
              </div>
            </div>
          </div>
        )}

        {/* Extra fields: Επαγγελματικά Ραντεβού */}
        {category === 'appointment' && (
          <div className="space-y-3 rounded-xl border border-border/10 p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Στοιχεία Ραντεβού</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Έναρξη</label>
                <input type="datetime-local" className="input w-full text-sm" value={appointment.start_datetime ?? ''} onChange={e => setAppointment(f => ({ ...f, start_datetime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Λήξη</label>
                <input type="datetime-local" className="input w-full text-sm" value={appointment.end_datetime ?? ''} onChange={e => setAppointment(f => ({ ...f, end_datetime: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Extra fields: Δικαστήριο */}
        {category === 'court' && (
          <div className="space-y-3 rounded-xl border border-border/10 p-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Στοιχεία Δικαστηρίου</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Έναρξη</label>
                <input type="datetime-local" className="input w-full text-sm" value={court.start_datetime ?? ''} onChange={e => setCourt(f => ({ ...f, start_datetime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Λήξη</label>
                <input type="datetime-local" className="input w-full text-sm" value={court.end_datetime ?? ''} onChange={e => setCourt(f => ({ ...f, end_datetime: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Αριθμός Απόφασης</label>
                <input className="input w-full text-sm" value={court.decision_number ?? ''} onChange={e => setCourt(f => ({ ...f, decision_number: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Ημερομηνία Έκδοσης</label>
                <input type="date" className="input w-full text-sm" value={court.decision_date ?? ''} onChange={e => setCourt(f => ({ ...f, decision_date: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Linked Tasks */}
        {!hideLinkedTasks && (
          <div className="space-y-3 rounded-xl border border-border/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Συνδεδεμένες Εργασίες
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { setShowTaskSearch(s => !s); }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 cursor-pointer transition-colors">
                  <Search className="h-3 w-3" />
                  Αναζήτηση
                </button>
                <button type="button" onClick={() => setShowNewTaskModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 cursor-pointer transition-colors">
                  <Plus className="h-3 w-3" />
                  Νέα
                </button>
              </div>
            </div>

            {linkedTasks.length > 0 && (
              <div className="space-y-1.5">
                {linkedTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white/4 px-3 py-2">
                    <span className="flex-1 text-xs text-text-primary truncate">{t.title}</span>
                    {t.due_date && <span className="text-[10px] text-text-secondary shrink-0">{t.due_date}</span>}
                    <button type="button" onClick={() => setLinkedTasks(lt => lt.filter(x => x.id !== t.id))}
                      className="text-text-secondary hover:text-danger cursor-pointer shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showTaskSearch && (
              <div className="space-y-1.5">
                <input
                  className="input w-full text-sm"
                  placeholder="Αναζήτηση εργασίας…"
                  value={taskQuery}
                  onChange={e => setTaskQuery(e.target.value)}
                  autoFocus
                />
                {searchingTasks && <p className="text-xs text-text-secondary px-1">Αναζήτηση…</p>}
                {taskOptions.length > 0 && (
                  <div className="rounded-lg border border-border/10 overflow-hidden divide-y divide-border/10 max-h-64 overflow-y-auto">
                    {taskOptions.map(t => (
                      <button key={t.id} type="button"
                        onClick={() => {
                          setLinkedTasks(lt => [...lt, t]);
                          setTaskQuery('');
                          setTaskOptions([]);
                          setShowTaskSearch(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors text-left">
                        <span className="text-sm text-text-primary truncate flex-1">{t.title}</span>
                        {t.due_date && <span className="text-[10px] text-text-secondary shrink-0">{t.due_date}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {!searchingTasks && taskQuery.trim() && taskOptions.length === 0 && (
                  <p className="text-xs text-text-secondary px-1">Δεν βρέθηκαν εργασίες.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Financials */}
        <div className="space-y-3 rounded-xl border border-border/10 p-4">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Οικονομικά</p>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Αμοιβή (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input w-full text-sm"
              placeholder="0.00"
              value={fee}
              onChange={e => setFee(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary">Έξοδα</label>
              <button type="button" onClick={addExpense}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 cursor-pointer transition-colors">
                <Plus className="h-3 w-3" />
                Προσθήκη
              </button>
            </div>
            {expenses.length === 0 ? (
              <p className="text-xs text-text-secondary italic">Δεν υπάρχουν έξοδα.</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((exp, i) => (
                  <div key={i} className="rounded-lg border border-border/10 bg-white/2 p-3 space-y-2">
                    <input
                      className="input w-full text-sm"
                      placeholder="Περιγραφή εξόδου"
                      value={exp.description}
                      onChange={e => setExpenseField(i, 'description', e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-full text-sm"
                        placeholder="Ποσό (€)"
                        value={exp.amount || ''}
                        onChange={e => setExpenseField(i, 'amount', e.target.value)}
                      />
                      <button type="button" onClick={() => removeExpense(i)}
                        className="p-1.5 rounded hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
          <textarea className="input w-full resize-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary cursor-pointer">Ακύρωση</button>
          <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
            {saving ? 'Αποθήκευση…' : submitLabel}
          </button>
        </div>
      </form>

      {showNewTaskModal && (
        <NewLinkedTaskModal
          tenantId={tenantId}
          defaultCaseId={case_id}
          onCreated={task => {
            setLinkedTasks(lt => [...lt, task]);
            setShowNewTaskModal(false);
          }}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}
    </>
  );
}

// ── New linked task modal ─────────────────────────────────────────────────────

function NewLinkedTaskModal({ tenantId, defaultCaseId, onCreated, onClose }: {
  tenantId: string;
  defaultCaseId: string;
  onCreated: (task: LinkedTask) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: TaskFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const result = await createTask(tenantId, {
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        case_id: values.case_id || defaultCaseId,
        category: values.category || undefined,
        extra_data: values.extra_data,
        fee: values.fee,
        expenses: values.expenses,
      });
      onCreated({
        id: result.id,
        title: values.title,
        due_date: values.due_date || null,
        status: 'open',
        category: values.category || null,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία δημιουργίας εργασίας.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/20 bg-secondary-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-secondary-background px-6 py-4 border-b border-border/10">
          <h2 className="text-sm font-semibold text-text-primary">Νέα Συνδεδεμένη Εργασία</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/8 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">
          <TaskForm
            tenantId={tenantId}
            initial={{ case_id: defaultCaseId }}
            saving={saving}
            error={error}
            hideLinkedTasks
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel="Δημιουργία & Σύνδεση"
          />
        </div>
      </div>
    </div>
  );
}
