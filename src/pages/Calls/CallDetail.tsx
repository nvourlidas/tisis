import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Users, Mail, Briefcase, User, CalendarDays,
  AlertCircle, RotateCcw, Pencil, Check, X, CalendarPlus, ListTodo,
} from 'lucide-react';
import { fetchCall, updateCall, syncCallToCalendar } from './callUtils';
import type { Call } from './types';
import EditCallModal from './modals/EditCallModal';
import TaskForm, { type TaskFormValues } from '../Tasks/TaskForm';
import { createTask } from '../Tasks/taskUtils';
import { useAuth } from '../../auth';

const DIRECTION_LABEL: Record<string, string> = {
  phone: 'Τηλεφώνημα',
  inperson: 'Δια ζώσης',
  email: 'Email',
};

const DIRECTION_ICON: Record<string, React.ReactNode> = {
  phone: <Phone className="h-4 w-4" />,
  inperson: <Users className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
};

const DIRECTION_COLOR: Record<string, { badge: string; icon: string }> = {
  phone: { badge: 'bg-green-500/10 text-green-400 border-green-500/20', icon: 'bg-green-500/10 text-green-500' },
  inperson: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: 'bg-blue-500/10 text-blue-500' },
  email: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: 'bg-purple-500/10 text-purple-500' },
};

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCreateTask = async (values: TaskFormValues) => {
    if (!call || !profile?.tenant_id) return;
    setCreatingTask(true);
    setTaskError(null);
    try {
      await createTask(profile.tenant_id, {
        title: values.title,
        description: values.description,
        due_date: values.due_date,
        due_time: values.due_time || undefined,
        case_id: values.case_id,
        category: values.category || undefined,
        extra_data: values.extra_data,
        hours: values.hours,
        linked_task_ids: values.linked_task_ids,
        source_call_id: call.id,
      });
      setShowTaskForm(false);
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Αποτυχία δημιουργίας εργασίας.');
    } finally {
      setCreatingTask(false);
    }
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const c = await fetchCall(id);
    setCall(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-sm text-text-secondary animate-pulse-soft">
        <RotateCcw className="h-4 w-4 animate-spin" />
        Φόρτωση γεγονότος…
      </div>
    );
  }

  if (!call) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate('/calls')} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Γεγονότα
        </button>
        <p className="text-sm text-text-secondary">Το γεγονός δεν βρέθηκε.</p>
      </div>
    );
  }

  const dir = call.direction ?? 'phone';
  const colors = DIRECTION_COLOR[dir] ?? DIRECTION_COLOR.phone;
  const dateObj = new Date(call.created_at);
  const dateStr = dateObj.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Athens' });
  const timeStr = dateObj.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Athens' });

  return (
    <>
      <EditCallModal
        open={editing}
        call={call}
        onClose={() => setEditing(false)}
        onUpdated={() => { setEditing(false); load(); }}
      />

      {/* New Task slide-in */}
      {showTaskForm && profile?.tenant_id && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTaskForm(false)}>
          <div className="w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Νέα Εργασία</h2>
              <button onClick={() => setShowTaskForm(false)} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            {taskError && <p className="text-xs text-red-400">{taskError}</p>}
            <TaskForm
              tenantId={profile.tenant_id}
              initial={{ case_id: call.case_id ?? '', case_code: call.case_code ?? undefined, case_title: call.case_title ?? undefined }}
              saving={creatingTask}
              error={taskError}
              onSubmit={handleCreateTask}
              onCancel={() => setShowTaskForm(false)}
              submitLabel="Δημιουργία Εργασίας"
            />
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Back */}
        <button onClick={() => navigate('/calls')} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary cursor-pointer transition-colors animate-fade-in">
          <ArrowLeft className="h-4 w-4" />
          Γεγονότα
        </button>

        {/* Header card */}
        <div className="animate-fade-in-up rounded-2xl border border-border/10 bg-secondary-background p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors.icon}`}>
                {DIRECTION_ICON[dir]}
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  {call.caller_name ?? call.phone ?? 'Άγνωστος'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.badge}`}>
                  {DIRECTION_ICON[dir]}
                  {DIRECTION_LABEL[dir]}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!call.google_event_id && (
                <button
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true);
                    try { await syncCallToCalendar(call); await load(); } finally { setSyncing(false); }
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {syncing ? 'Συγχρονισμός…' : 'Προσθήκη στο Calendar'}
                </button>
              )}
              <button
                onClick={() => setShowTaskForm(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
              >
                <ListTodo className="h-3.5 w-3.5" />
                Νέα Εργασία
              </button>
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Επεξεργασία
              </button>
            </div>
          </div>

          {/* Info chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <InfoCard
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Ημερομηνία"
              value={`${dateStr} ${timeStr}`}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            {call.phone && (
              <InfoCard
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Τηλέφωνο"
                value={call.phone}
                color="text-text-secondary"
                bg="bg-border/10"
              />
            )}
            {call.email && (
              <InfoCard
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
                value={call.email}
                color="text-purple-500"
                bg="bg-purple-500/10"
              />
            )}
            {call.caller_name && (
              <InfoCard
                icon={<User className="h-3.5 w-3.5" />}
                label="Επαφή"
                value={call.caller_name}
                color="text-teal-500"
                bg="bg-teal-500/10"
              />
            )}
            {call.case_code && (
              <button
                onClick={() => call.case_id && navigate(`/cases/${call.case_id}`)}
                className="flex items-center gap-2.5 rounded-xl border border-border/10 bg-secondary-background p-3 hover:border-primary/20 hover:bg-primary/5 transition-colors cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-text-secondary uppercase tracking-wider">Υπόθεση</div>
                  <div className="text-xs font-mono text-primary truncate">{call.case_code}</div>
                  {call.case_title && <div className="text-xs text-text-primary truncate">{call.case_title}</div>}
                </div>
              </button>
            )}
            {!call.case_id && (
              <div className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <span className="text-xs text-orange-400">Χωρίς υπόθεση</span>
              </div>
            )}
          </div>

          {/* Description */}
          {call.description && (
            <div className="rounded-xl border border-border/10 bg-background p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Περιγραφή</div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{call.description}</p>
            </div>
          )}
        </div>

        {/* Follow-up card */}
        {call.follow_up_required && (
          <div className={`animate-fade-in-up rounded-2xl border p-6 space-y-3 ${call.follow_up_done ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {call.follow_up_done
                  ? <Check className="h-4 w-4 text-green-400" />
                  : <AlertCircle className="h-4 w-4 text-orange-400" />
                }
                <h2 className={`text-sm font-semibold ${call.follow_up_done ? 'text-green-400' : 'text-orange-400'}`}>
                  {call.follow_up_done ? 'Follow-up ολοκληρώθηκε' : 'Follow-up απαιτείται'}
                </h2>
              </div>
              {!editingNotes && (
                <div className="flex items-center gap-2">
                  {!call.follow_up_done && (
                  <button
                    onClick={async () => {
                      await updateCall(call.id, { follow_up_done: true });
                      await load();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-green-500/20 bg-green-500/10 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"
                  >
                    <Check className="h-3 w-3" />
                    Ολοκληρώθηκε
                  </button>
                  )}
                  {call.follow_up_done && (
                  <button
                    onClick={async () => {
                      await updateCall(call.id, { follow_up_done: false });
                      await load();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/20 bg-white/4 text-xs font-medium text-text-secondary hover:text-orange-400 hover:border-orange-500/20 hover:bg-orange-500/5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Αναίρεση
                  </button>
                  )}
                  <button
                    onClick={() => { setNotesValue(call.follow_up_notes ?? ''); setEditingNotes(true); setTimeout(() => textareaRef.current?.focus(), 0); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-500/20 bg-orange-500/10 text-xs font-medium text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    Επεξεργασία
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-orange-400/70 uppercase tracking-wider">Εξέλιξη</div>
                <textarea
                  ref={textareaRef}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={10}
                  className="w-full rounded-xl border border-orange-500/30 bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
                  placeholder="Προσθέστε σημειώσεις follow-up…"
                />
                <div className="flex items-center gap-2">
                  <button
                    disabled={savingNotes}
                    onClick={async () => {
                      setSavingNotes(true);
                      await updateCall(call.id, { follow_up_notes: notesValue || undefined });
                      await load();
                      setEditingNotes(false);
                      setSavingNotes(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-xs font-medium text-orange-400 hover:bg-orange-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Αποθήκευση
                  </button>
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 text-xs font-medium text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    Ακύρωση
                  </button>
                </div>
              </div>
            ) : (
              call.follow_up_notes && (
                <div>
                  <div className="text-xs font-medium text-orange-400/70 uppercase tracking-wider mb-1">Εξέλιξη</div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{call.follow_up_notes}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </>
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
