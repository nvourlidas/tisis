import { X, CalendarDays, Tag, Briefcase, User, Check, Clock, Euro, Receipt, FileText } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { TASK_CATEGORIES } from './taskUtils';
import type { Task, LegalActData, AppointmentData } from './taskUtils';

type Props = {
  task: Task | null;
  onClose: () => void;
  onNavigateToCase?: (caseId: string) => void;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
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
    <div className="flex items-center gap-3 rounded-xl border border-border/10 bg-secondary-background p-3">
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

export default function TaskDetailModal({ task, onClose, onNavigateToCase }: Props) {
  if (!task) return null;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.status === 'open' && !!task.due_date && task.due_date < today;
  const isDone = task.status === 'done';

  const legalAct = task.category === 'legal_act' ? (task.extra_data as LegalActData | null) : null;
  const appointment = task.category === 'appointment' ? (task.extra_data as AppointmentData | null) : null;

  const totalExpenses = task.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              isDone ? 'border-green-500 bg-green-500 text-white' :
              isOverdue ? 'border-orange-400' : 'border-border/40'
            }`}>
              {isDone && <Check className="h-3 w-3" />}
            </div>
            <h2 className={`text-base font-semibold leading-tight ${isDone ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
              {task.title}
            </h2>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer shrink-0 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Status + category chips */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isDone ? 'bg-green-500/10 text-green-500' :
              isOverdue ? 'bg-orange-500/10 text-orange-500' :
              'bg-primary/10 text-primary'
            }`}>
              {isDone ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {isDone ? 'Ολοκληρώθηκε' : isOverdue ? 'Ληξιπρόθεσμη' : 'Ανοιχτή'}
            </span>
            {task.category && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-border/10 text-text-secondary">
                <Tag className="h-3 w-3" />
                {TASK_CATEGORIES[task.category]}
              </span>
            )}
          </div>

          {/* Key info cards */}
          <div className="grid grid-cols-2 gap-2">
            {task.due_date && (
              <InfoCard
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Προθεσμία"
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
                onClick={() => task.case_id && onNavigateToCase?.(task.case_id)}
                className="flex items-center gap-3 rounded-xl border border-border/10 bg-secondary-background p-3 hover:border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-text-secondary uppercase tracking-wider">Υπόθεση</div>
                  <div className="text-xs font-mono text-primary truncate">{task.case_code}</div>
                  <div className="text-xs text-text-primary truncate">{task.case_title}</div>
                </div>
              </button>
            )}
            {task.client_name && (
              <InfoCard
                icon={<User className="h-3.5 w-3.5" />}
                label="Εντολέας"
                value={task.client_name}
                color="text-green-500"
                bg="bg-green-500/10"
              />
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="rounded-xl border border-border/10 bg-background p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Περιγραφή</div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Legal act extra data */}
          {legalAct && (
            <div className="rounded-xl border border-border/10 bg-background p-4 space-y-3">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Νομικές Πράξεις</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Αρ. Πρωτοκόλλου" value={legalAct.protocol_number} />
                <Field label="Ημ/νία Δημιουργίας" value={legalAct.creation_date ? formatDate(legalAct.creation_date) : undefined} />
                <Field label="Αρχή" value={legalAct.authority} />
                <Field label="ΓΑΚ" value={legalAct.gak} />
                <Field label="ΕΚΑ" value={legalAct.eka} />
              </div>
              {legalAct.decision && (legalAct.decision.number || legalAct.decision.date || legalAct.decision.description) && (
                <div className="pt-2 border-t border-border/10 space-y-2">
                  <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Απόφαση</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Αριθμός" value={legalAct.decision.number} />
                    <Field label="Ημ/νία" value={legalAct.decision.date ? formatDate(legalAct.decision.date) : undefined} />
                  </div>
                  {legalAct.decision.description && (
                    <Field label="Περιγραφή" value={legalAct.decision.description} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Appointment extra data */}
          {appointment && (appointment.start_datetime || appointment.end_datetime) && (
            <div className="rounded-xl border border-border/10 bg-background p-4 space-y-3">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Ραντεβού</div>
              <div className="grid grid-cols-2 gap-3">
                {appointment.start_datetime && (
                  <Field label="Έναρξη" value={new Date(appointment.start_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                )}
                {appointment.end_datetime && (
                  <Field label="Λήξη" value={new Date(appointment.end_datetime).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                )}
              </div>
            </div>
          )}

          {/* Financials */}
          {(task.fee || (task.expenses?.length ?? 0) > 0) && (
            <div className="rounded-xl border border-border/10 bg-background p-4 space-y-3">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Οικονομικά</div>
              {task.fee != null && task.fee > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Euro className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-text-secondary">Αμοιβή:</span>
                  <span className="font-semibold text-green-500">{task.fee.toFixed(2)} €</span>
                </div>
              )}
              {(task.expenses?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
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
          )}

          {/* Notes / created at */}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            Δημιουργήθηκε: {new Date(task.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>

        </div>
      </div>
    </div>
  );
}
