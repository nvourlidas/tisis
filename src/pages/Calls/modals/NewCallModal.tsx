import { useEffect, useRef, useState } from 'react';
import { X, Phone, Users, Mail, Search, UserCheck, UserPlus, CheckSquare, Pencil, Briefcase, Unlink } from 'lucide-react';
import { useAuth } from '../../../auth';
import { createCall, searchContactsForCall, searchCasesForCall } from '../callUtils';
import { createContact } from '../../Contacts/contactUtils';
import { createTask } from '../../Tasks/taskUtils';
import TaskForm, { type TaskFormValues } from '../../Tasks/TaskForm';
import NewContactModal from '../../Contacts/modals/NewContactModal';
import type { CallFormData } from '../types';
import type { ContactFormData } from '../../Contacts/types';

type ContactHit = { id: string; name: string; phone: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (callId: string) => void;
  initialPhone?: string;
  initialCaseId?: string;
  initialContactId?: string;
  initialContactName?: string;
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const empty = (): CallFormData => ({
  phone: '',
  caller_name: '',
  direction: 'phone',
  case_id: '',
  contact_id: '',
  description: '',
  follow_up_required: false,
  follow_up_notes: '',
  no_case_intentional: false,
  create_task: false,
  task_title: '',
  task_due_date: '',
  created_at: nowLocal(),
});

export default function NewCallModal({ open, onClose, onCreated, initialPhone, initialCaseId, initialContactId, initialContactName }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [form, setForm] = useState<CallFormData>(() => ({ ...empty(), phone: initialPhone ?? '' }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [pendingTask, setPendingTask] = useState<TaskFormValues | null>(null);
  const [taskSaving] = useState(false);

  // Contact search
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<ContactHit[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactHit | null>(null);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [showContactDrop, setShowContactDrop] = useState(false);

  // Case toggle
  const [wantsCase, setWantsCase] = useState(false);

  // Case search
  const [showCaseSearch, setShowCaseSearch] = useState(false);
  const [caseQuery, setCaseQuery] = useState('');
  const [caseOptions, setCaseOptions] = useState<{ id: string; code: string; title: string; client_name?: string }[]>([]);
  const [selectedCase, setSelectedCase] = useState<{ id: string; code: string; title: string; client_name?: string } | null>(null);
  const [searchingCases, setSearchingCases] = useState(false);

  const contactInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      const phone = initialPhone ?? '';
      const preContact: ContactHit | null = initialContactId && initialContactName
        ? { id: initialContactId, name: initialContactName, phone: phone || null }
        : null;
      setForm({ ...empty(), phone, case_id: initialCaseId ?? '', contact_id: initialContactId ?? '' });
      setContactQuery(preContact ? preContact.name : phone);
      setSelectedContact(preContact);
      setContactResults([]);
      setShowContactDrop(false);
      setSelectedCase(null);
      setCaseQuery('');
      setCaseOptions([]);
      setShowCaseSearch(false);
      setWantsCase(!!initialCaseId);
      setError(null);
      setPendingTask(null);
      setShowTaskModal(false);
      setShowNewContactModal(false);
      setTimeout(() => contactInputRef.current?.focus(), 50);
    }
  }, [open, initialPhone, initialCaseId, initialContactId, initialContactName]);

  // Contact search debounce
  useEffect(() => {
    if (selectedContact || contactQuery.trim().length < 2) {
      setContactResults([]);
      setShowContactDrop(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingContacts(true);
      const results = await searchContactsForCall(tenantId, contactQuery.trim());
      setContactResults(results);
      setShowContactDrop(true);
      setSearchingContacts(false);
    }, 250);
    return () => clearTimeout(t);
  }, [contactQuery, tenantId, selectedContact]);

  // Case search debounce
  useEffect(() => {
    if (!showCaseSearch || !caseQuery.trim() || !tenantId) { setCaseOptions([]); return; }
    const t = setTimeout(async () => {
      setSearchingCases(true);
      const results = await searchCasesForCall(tenantId, caseQuery.trim());
      setCaseOptions(results);
      setSearchingCases(false);
    }, 250);
    return () => clearTimeout(t);
  }, [caseQuery, showCaseSearch, tenantId]);

  const selectContact = (c: ContactHit) => {
    setSelectedContact(c);
    setContactQuery(c.name);
    setForm((f) => ({ ...f, phone: c.phone ?? f.phone, caller_name: c.name, contact_id: c.id }));
    setShowContactDrop(false);
    setContactResults([]);
  };

  const clearContact = () => {
    setSelectedContact(null);
    setContactQuery('');
    setForm((f) => ({ ...f, caller_name: '', contact_id: '' }));
  };

  const selectCase = (c: { id: string; code: string; title: string }) => {
    setSelectedCase(c);
    setForm((f) => ({ ...f, case_id: c.id }));
    setShowCaseSearch(false);
    setCaseQuery('');
    setCaseOptions([]);
  };

  const clearCase = () => {
    setSelectedCase(null);
    setForm((f) => ({ ...f, case_id: '' }));
  };

  const set = <K extends keyof CallFormData>(k: K, v: CallFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const callId = await createCall(tenantId, { ...form, no_case_intentional: !wantsCase && !form.case_id });
      if (form.create_task && pendingTask) {
        await createTask(tenantId, {
          title: pendingTask.title,
          description: pendingTask.description,
          due_date: pendingTask.due_date,
          case_id: pendingTask.case_id || form.case_id,
          category: pendingTask.category || undefined,
          extra_data: pendingTask.extra_data,
        });
      }
      onCreated?.(callId);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία καταχώρησης γεγονότος.');
    } finally {
      setSaving(false);
    }
  };

  const handleNewContact = async (data: ContactFormData) => {
    const newContact = await createContact(tenantId, data);
    selectContact({ id: newContact.id, name: newContact.name, phone: newContact.phone ?? null });
    setShowNewContactModal(false);
  };

  const handleTaskSubmit = (values: TaskFormValues) => {
    setPendingTask(values);
    setShowTaskModal(false);
  };

  if (!open) return null;

  const showCreateNew = showContactDrop && contactQuery.trim().length >= 2 && !searchingContacts && contactResults.length === 0;
  const showDropdown = showContactDrop && (searchingContacts || contactResults.length > 0 || showCreateNew);

  return (
    <>
    <NewContactModal
      open={showNewContactModal}
      onClose={() => setShowNewContactModal(false)}
      onSubmit={handleNewContact}
      initialPhone={form.phone || contactQuery.trim()}
      tenantId={tenantId}
      zIndex="z-[70]"
    />
    {showTaskModal && (
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
            <h2 className="text-base font-semibold text-text-primary">Νέα Εργασία</h2>
            <button onClick={() => { setShowTaskModal(false); if (!pendingTask) set('create_task', false); }} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-6">
            <TaskForm
              tenantId={tenantId}
              initial={pendingTask ?? { case_id: form.case_id }}
              saving={taskSaving}
              error={null}
              onSubmit={handleTaskSubmit}
              onCancel={() => { setShowTaskModal(false); if (!pendingTask) set('create_task', false); }}
              submitLabel="Αποθήκευση Εργασίας"
            />
          </div>
        </div>
      </div>
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-secondary-background rounded-2xl border border-border/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 sticky top-0 bg-secondary-background z-10">
          <h2 className="text-base font-semibold text-text-primary">Νέο Γεγονός</h2>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Direction toggle + date/time */}
          <div className="flex gap-2">
            {([
              { key: 'phone', label: 'Τηλεφώνημα', icon: <Phone className="h-4 w-4" />, active: 'border-green-500/30 bg-green-500/10 text-green-400' },
              { key: 'inperson', label: 'Δια ζώσης', icon: <Users className="h-4 w-4" />, active: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
              { key: 'email', label: 'Email', icon: <Mail className="h-4 w-4" />, active: 'border-purple-500/30 bg-purple-500/10 text-purple-400' },
            ] as const).map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => set('direction', d.key)}
                className={[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer',
                  form.direction === d.key ? d.active : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                ].join(' ')}
              >
                {d.icon}{d.label}
              </button>
            ))}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ημερομηνία</label>
              <input
                type="date"
                className="input w-full"
                value={form.created_at.slice(0, 10)}
                onChange={(e) => set('created_at', e.target.value + 'T' + (form.created_at.slice(11, 16) || '00:00'))}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ώρα</label>
              <input
                type="time"
                className="input w-full"
                value={form.created_at.slice(11, 16)}
                onChange={(e) => set('created_at', (form.created_at.slice(0, 10) || new Date().toISOString().slice(0, 10)) + 'T' + e.target.value)}
              />
            </div>
          </div>

          {/* Contact search */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Επαφή (τηλέφωνο ή όνομα)</label>

            {selectedContact ? (
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                <UserCheck className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary">{selectedContact.name}</span>
                  {selectedContact.phone && (
                    <span className="text-xs text-text-secondary ml-2">{selectedContact.phone}</span>
                  )}
                </div>
                <button type="button" onClick={clearContact} className="text-text-secondary hover:text-danger cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                <input
                  ref={contactInputRef}
                  className="input w-full pl-9!"
                  placeholder="Αναζήτηση επαφής…"
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  onFocus={() => { if (contactResults.length > 0) setShowContactDrop(true); }}
                  onBlur={() => setTimeout(() => setShowContactDrop(false), 150)}
                  autoComplete="off"
                />
                {searchingContacts && (
                  <p className="mt-1 text-xs text-text-secondary">Αναζήτηση…</p>
                )}
                {showDropdown && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl border border-border/10 bg-secondary-background shadow-xl overflow-hidden">
                    {contactResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => selectContact(c)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors text-left"
                      >
                        <UserCheck className="h-4 w-4 text-text-secondary shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm text-text-primary">{c.name}</div>
                          {c.phone && <div className="text-xs text-text-secondary">{c.phone}</div>}
                        </div>
                      </button>
                    ))}
                    {showCreateNew && (
                      <button
                        type="button"
                        onMouseDown={() => { setShowContactDrop(false); setShowNewContactModal(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-border/10 hover:bg-primary/5 transition-colors cursor-pointer text-left"
                      >
                        <UserPlus className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm text-primary font-medium">Δημιουργία νέας επαφής «{contactQuery.trim()}»</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phone (always visible, pre-filled from contact) */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Τηλέφωνο</label>
            <input
              className="input w-full"
              placeholder="π.χ. 6912345678"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>

          {/* Description — required */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Περιγραφή <span className="text-danger">*</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              placeholder="Σύντομη περιγραφή του γεγονότος…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>

          {/* Link to case — hidden when opened from a case detail */}
          {!initialCaseId && (
            <div className="space-y-3">
              <label className="block text-sm text-text-secondary">Υπόθεση</label>

              {/* Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setWantsCase(false); clearCase(); setShowCaseSearch(false); setCaseQuery(''); }}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer',
                    !wantsCase
                      ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                      : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                  ].join(' ')}
                >
                  <Unlink className="h-4 w-4" />
                  Χωρίς υπόθεση
                </button>
                <button
                  type="button"
                  onClick={() => { setWantsCase(true); if (!showCaseSearch && !selectedCase) setShowCaseSearch(true); }}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer',
                    wantsCase
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/10 bg-white/3 text-text-secondary hover:bg-white/5',
                  ].join(' ')}
                >
                  <Briefcase className="h-4 w-4" />
                  Σύνδεση σε υπόθεση
                </button>
              </div>


              {/* Case search / selected — only when wantsCase */}
              {wantsCase && (
                selectedCase ? (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
                    <span className="font-mono text-xs text-text-secondary shrink-0">{selectedCase.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{selectedCase.title}</div>
                      {selectedCase.client_name && (
                        <div className="text-xs text-text-secondary truncate">{selectedCase.client_name}</div>
                      )}
                    </div>
                    <button type="button" onClick={clearCase} className="text-text-secondary hover:text-danger cursor-pointer shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                      <input
                        className="input w-full pl-9!"
                        placeholder="Αναζήτηση κωδικού, τίτλου ή εντολέα…"
                        value={caseQuery}
                        onChange={(e) => setCaseQuery(e.target.value)}
                        autoFocus={showCaseSearch}
                      />
                    </div>
                    {searchingCases && <p className="text-xs text-text-secondary">Αναζήτηση…</p>}
                    {caseOptions.length > 0 && (
                      <div className="rounded-xl border border-border/10 overflow-hidden divide-y divide-border/10">
                        {caseOptions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCase(c)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors text-left"
                          >
                            <span className="font-mono text-xs text-text-secondary shrink-0">{c.code}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-text-primary truncate">{c.title}</div>
                              {c.client_name && (
                                <div className="text-xs text-text-secondary truncate">{c.client_name}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {caseQuery.trim() && !searchingCases && caseOptions.length === 0 && (
                      <p className="text-xs text-text-secondary">Δεν βρέθηκαν υποθέσεις.</p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Follow-up + Create task */}
          <div className="space-y-3 rounded-xl border border-border/10 bg-white/2 px-4 py-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.follow_up_required}
                onChange={(e) => set('follow_up_required', e.target.checked)}
              />
              <span className="text-sm text-text-secondary">Απαιτείται follow-up</span>
            </label>
            {form.follow_up_required && (
              <div className="pl-6">
                <textarea
                  className="input w-full resize-none"
                  rows={2}
                  placeholder="Εξέλιξη / σημειώσεις follow-up…"
                  value={form.follow_up_notes}
                  onChange={(e) => set('follow_up_notes', e.target.value)}
                />
              </div>
            )}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border/20 cursor-pointer"
                checked={form.create_task}
                onChange={(e) => {
                  set('create_task', e.target.checked);
                  if (e.target.checked) setShowTaskModal(true);
                  else setPendingTask(null);
                }}
              />
              <span className="text-sm text-text-secondary">Δημιουργία εργασίας από αυτό το γεγονός</span>
            </label>
            {form.create_task && (
              <div className="pl-6">
                {pendingTask ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm text-text-primary truncate">{pendingTask.title}</span>
                      {pendingTask.due_date && (
                        <span className="text-xs text-text-secondary shrink-0">{pendingTask.due_date}</span>
                      )}
                    </div>
                    <button type="button" onClick={() => setShowTaskModal(true)} className="shrink-0 text-text-secondary hover:text-primary cursor-pointer">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTaskModal(true)}
                    className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border/20 bg-white/2 px-3 py-2 text-sm text-text-secondary hover:border-border/40 hover:bg-white/4 transition-all cursor-pointer"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Ρύθμιση εργασίας…
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary cursor-pointer">Ακύρωση</button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Καταχώρηση Γεγονότος'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
