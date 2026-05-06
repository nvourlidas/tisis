import { useState } from 'react';
import { Pencil, Check, X, ExternalLink, CalendarDays, User, Tag, Layers, Globe } from 'lucide-react';
import { formatDate } from '../../../lib/dateUtils';
import { updateCase, fetchStages } from '../caseUtils';
import { fetchClients } from '../../Clients/clientUtils';
import type { Client } from '../../Clients/types';
import type { Case, CaseFormData, CaseStage, CaseType } from '../types';

const CASE_TYPES: CaseType[] = ['Αστικό', 'Ποινικό', 'Διοικητικό', 'Εμπορικό'];

type Props = {
  caseData: Case;
  tenantId: string;
  onUpdate: (c: Case) => void;
};

export default function CaseInfo({ caseData, tenantId, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CaseFormData>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<CaseStage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setForm({
      code: caseData.code,
      title: caseData.title,
      client_id: caseData.client_id ?? '',
      status: caseData.status,
      type: caseData.type ?? '',
      stage_id: caseData.stage_id ?? '',
      description: caseData.description ?? '',
      next_critical_date: caseData.next_critical_date ?? '',
      google_drive_url: caseData.google_drive_url ?? '',
      notes: caseData.notes ?? '',
    });
    setEditing(true);
    setError(null);
    if (tenantId) {
      fetchClients(tenantId).then(setClients);
      fetchStages(tenantId).then(setStages);
    }
  };

  const cancelEdit = () => { setEditing(false); setError(null); };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCase(caseData.id, form);
      const clientName = clients.find((c) => c.id === form.client_id)?.name ?? caseData.client_name ?? null;
      const stageName = stages.find((s) => s.id === form.stage_id)?.name ?? null;
      onUpdate({ ...caseData, ...form, client_name: clientName, stage_name: stageName } as Case);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof CaseFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  if (editing) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-end gap-2">
          <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
            <X className="h-3.5 w-3.5" />Ακύρωση
          </button>
          <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-60">
            <Check className="h-3.5 w-3.5" />{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
        {error && <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-2">{error}</p>}
        <div className="rounded-xl border border-border/10 bg-secondary-background p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Κωδικός" required>
            <input className="input w-full rounded-xl border-border/15" value={form.code ?? ''} onChange={set('code')} required />
          </FormField>
          <FormField label="Κατάσταση">
            <select className="select w-full" value={form.status ?? 'active'} onChange={set('status')}>
              <option value="active">Ενεργή</option>
              <option value="pending">Εκκρεμής</option>
              <option value="closed">Κλειστή</option>
            </select>
          </FormField>
          <FormField label="Τύπος Υπόθεσης">
            <select className="select w-full" value={form.type ?? ''} onChange={set('type')}>
              <option value="">— Επιλέξτε τύπο —</option>
              {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Τίτλος" required>
              <input className="input w-full rounded-xl border-border/15" value={form.title ?? ''} onChange={set('title')} required />
            </FormField>
          </div>
          <FormField label="Εντολέας">
            <select className="select w-full" value={form.client_id ?? ''} onChange={set('client_id')}>
              <option value="">— Χωρίς εντολέα —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Στάδιο">
            <select className="select w-full" value={form.stage_id ?? ''} onChange={set('stage_id')}>
              <option value="">— Χωρίς στάδιο —</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Επόμενη Κρίσιμη Ημερομηνία">
            <input className="input w-full rounded-xl border-border/15" type="date" value={form.next_critical_date ?? ''} onChange={set('next_critical_date')} />
          </FormField>
          <FormField label="Google Drive URL">
            <input className="input w-full rounded-xl border-border/15" type="url" value={form.google_drive_url ?? ''} onChange={set('google_drive_url')} placeholder="https://drive.google.com/…" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Περιγραφή">
              <textarea className="input w-full rounded-xl border-border/15 resize-none" rows={3} value={form.description ?? ''} onChange={set('description')} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Σημειώσεις">
              <textarea className="input w-full rounded-xl border-border/15 resize-none" rows={3} value={form.notes ?? ''} onChange={set('notes')} />
            </FormField>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-end">
        <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer">
          <Pencil className="h-3.5 w-3.5" />Επεξεργασία
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard icon={<Tag className="h-4 w-4" />} iconColor="text-blue-500" iconBg="bg-blue-500/10" label="Τύπος Υπόθεσης" value={caseData.type} />
        <InfoCard icon={<Layers className="h-4 w-4" />} iconColor="text-purple-500" iconBg="bg-purple-500/10" label="Στάδιο" value={caseData.stage_name} />
        <InfoCard
          icon={<CalendarDays className="h-4 w-4" />}
          iconColor="text-orange-500"
          iconBg="bg-orange-500/10"
          label="Επόμενη Κρίσιμη Ημερομηνία"
          value={caseData.next_critical_date ? formatDate(caseData.next_critical_date) : null}
        />
        {caseData.client_name && (
          <InfoCard icon={<User className="h-4 w-4" />} iconColor="text-green-500" iconBg="bg-green-500/10" label="Εντολέας" value={caseData.client_name} />
        )}
        {caseData.google_drive_url && (
          <div className="rounded-xl border border-border/10 bg-secondary-background p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs text-text-secondary mb-1">Google Drive</div>
              <a
                href={caseData.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                Άνοιγμα φακέλου
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {(caseData.description || caseData.notes) && (
        <div className="rounded-xl border border-border/10 bg-secondary-background divide-y divide-border/10">
          {caseData.description && (
            <div className="p-5">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Περιγραφή</div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{caseData.description}</p>
            </div>
          )}
          {caseData.notes && (
            <div className="p-5">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Σημειώσεις</div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{caseData.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, iconColor, iconBg, label, value }: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border/10 bg-secondary-background p-4 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-text-secondary mb-0.5">{label}</div>
        <div className="text-sm font-medium text-text-primary">{value}</div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
