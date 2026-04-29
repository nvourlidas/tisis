import { useState } from 'react';
import { Pencil, Check, X, ExternalLink } from 'lucide-react';
import { formatDate } from '../../../lib/dateUtils';
import { updateCase } from '../caseUtils';
import { fetchClients } from '../../Clients/clientUtils';
import type { Client } from '../../Clients/types';
import type { Case, CaseFormData, CaseType } from '../types';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setForm({
      code: caseData.code,
      title: caseData.title,
      client_id: caseData.client_id ?? '',
      status: caseData.status,
      type: caseData.type ?? '',
      stage: caseData.stage ?? '',
      description: caseData.description ?? '',
      next_critical_date: caseData.next_critical_date ?? '',
      google_drive_url: caseData.google_drive_url ?? '',
      notes: caseData.notes ?? '',
    });
    setEditing(true);
    setError(null);
    if (tenantId) fetchClients(tenantId).then(setClients);
  };

  const cancelEdit = () => { setEditing(false); setError(null); };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCase(caseData.id, form);
      const clientName = clients.find((c) => c.id === form.client_id)?.name ?? caseData.client_name ?? null;
      onUpdate({ ...caseData, ...form, client_name: clientName } as Case);
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
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <button onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
            <X className="h-3.5 w-3.5" />Ακύρωση
          </button>
          <button onClick={saveEdit} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer">
            <Check className="h-3.5 w-3.5" />{saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="rounded-xl border border-border/10 bg-secondary-background p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Κωδικός <span className="text-danger">*</span></label>
            <input className="input w-full" value={form.code ?? ''} onChange={set('code')} required />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Κατάσταση</label>
            <select className="input w-full" value={form.status ?? 'active'} onChange={set('status')}>
              <option value="active">Ενεργή</option>
              <option value="pending">Εκκρεμής</option>
              <option value="closed">Κλειστή</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Τύπος Υπόθεσης</label>
            <select className="input w-full" value={form.type ?? ''} onChange={set('type')}>
              <option value="">— Επιλέξτε τύπο —</option>
              {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-text-secondary mb-1">Τίτλος <span className="text-danger">*</span></label>
            <input className="input w-full" value={form.title ?? ''} onChange={set('title')} required />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Εντολέας</label>
            <select className="input w-full" value={form.client_id ?? ''} onChange={set('client_id')}>
              <option value="">— Χωρίς εντολέα —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Στάδιο</label>
            <input className="input w-full" value={form.stage ?? ''} onChange={set('stage')} placeholder="π.χ. Α΄ Βαθμός" />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Επόμενη Κρίσιμη Ημερομηνία</label>
            <input className="input w-full" type="date" value={form.next_critical_date ?? ''} onChange={set('next_critical_date')} />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Google Drive URL</label>
            <input className="input w-full" type="url" value={form.google_drive_url ?? ''} onChange={set('google_drive_url')} placeholder="https://drive.google.com/..." />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-text-secondary mb-1">Περιγραφή</label>
            <textarea className="input w-full resize-none" rows={3} value={form.description ?? ''} onChange={set('description')} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-text-secondary mb-1">Σημειώσεις</label>
            <textarea className="input w-full resize-none" rows={3} value={form.notes ?? ''} onChange={set('notes')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={startEdit} className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer">
          <Pencil className="h-3.5 w-3.5" />Επεξεργασία
        </button>
      </div>

      <div className="rounded-xl border border-border/10 bg-secondary-background divide-y divide-border/10">
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="Τύπος Υπόθεσης" value={caseData.type} />
          <InfoField label="Στάδιο" value={caseData.stage} />
          <InfoField
            label="Επόμενη Κρίσιμη Ημερομηνία"
            value={caseData.next_critical_date
              ? formatDate(caseData.next_critical_date)
              : null}
          />
          {caseData.client_name && (
            <InfoField label="Εντολέας" value={caseData.client_name} />
          )}
          {caseData.google_drive_url && (
            <div>
              <div className="text-xs text-text-secondary mb-1">Google Drive</div>
              <a
                href={caseData.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Άνοιγμα φακέλου
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {(caseData.description || caseData.notes) && (
          <div className="p-5 space-y-3">
            {caseData.description && (
              <div>
                <div className="text-xs text-text-secondary mb-1">Περιγραφή</div>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{caseData.description}</p>
              </div>
            )}
            {caseData.notes && (
              <div>
                <div className="text-xs text-text-secondary mb-1">Σημειώσεις</div>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{caseData.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-text-secondary mb-0.5">{label}</div>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}
