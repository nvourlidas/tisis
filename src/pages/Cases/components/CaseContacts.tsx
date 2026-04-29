import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchCaseContacts, addContactToCase, removeContactFromCase } from '../caseUtils';
import { createContact } from '../../Contacts/contactUtils';
import RoleSelect from '../../../components/RoleSelect';
import type { CaseContact } from '../types';

type Props = { caseId: string; tenantId: string };
type ContactOption = { id: string; name: string; phone: string | null; role: string | null };
type Mode = 'none' | 'search' | 'create';

const emptyForm = { name: '', phone: '', phone2: '', email: '', role: '', notes: '' };

export default function CaseContacts({ caseId, tenantId }: Props) {
  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('none');
  const [removing, setRemoving] = useState<string | null>(null);

  // search existing
  const [searchQ, setSearchQ] = useState('');
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [searching, setSearching] = useState(false);

  // create new
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseContacts(caseId).then(setContacts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  useEffect(() => {
    if (mode !== 'search' || !searchQ.trim()) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone, role')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${searchQ.trim()}%`)
        .limit(10);
      const existing = new Set(contacts.map((c) => c.contact_id));
      setOptions((data ?? []).filter((c: ContactOption) => !existing.has(c.id)));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ, mode, tenantId, contacts]);

  const openMode = (m: Mode) => {
    setMode(prev => prev === m ? 'none' : m);
    setSearchQ('');
    setOptions([]);
    setForm({ ...emptyForm });
    setError(null);
  };

  const addExisting = async (contactId: string) => {
    await addContactToCase(caseId, contactId);
    setMode('none');
    setSearchQ('');
    setOptions([]);
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const newContact = await createContact(tenantId, { ...form, tenant_id: tenantId } as any);
      await addContactToCase(caseId, newContact.id);
      setMode('none');
      setForm({ ...emptyForm });
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία δημιουργίας επαφής.');
    } finally {
      setSaving(false);
    }
  };

  const removeContact = async (contactId: string) => {
    setRemoving(contactId);
    try {
      await removeContactFromCase(caseId, contactId);
      setContacts(prev => prev.filter(c => c.contact_id !== contactId));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-secondary">{contacts.length} επαφές</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openMode('search')}
            className={`btn-secondary inline-flex items-center gap-1.5 cursor-pointer ${mode === 'search' ? 'ring-1 ring-primary/30' : ''}`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη υπάρχουσας
          </button>
          <button
            onClick={() => openMode('create')}
            className={`btn-secondary inline-flex items-center gap-1.5 cursor-pointer ${mode === 'create' ? 'ring-1 ring-primary/30' : ''}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Νέα Επαφή
          </button>
        </div>
      </div>

      {/* Search existing */}
      {mode === 'search' && (
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Προσθήκη υπάρχουσας επαφής</h3>
            <button onClick={() => openMode('none')} className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
            <input
              className="input w-full pl-9!"
              placeholder="Αναζήτηση επαφής με όνομα…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
            />
          </div>
          {searching && <p className="text-xs text-text-secondary">Αναζήτηση…</p>}
          {options.length > 0 && (
            <div className="divide-y divide-border/10 rounded-lg border border-border/10 overflow-hidden">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => addExisting(opt.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div className="text-left">
                    <div className="text-sm text-text-primary">{opt.name}</div>
                    {(opt.phone || opt.role) && (
                      <div className="text-xs text-text-secondary">{[opt.role, opt.phone].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
          {searchQ.trim() && !searching && options.length === 0 && (
            <p className="text-xs text-text-secondary">Δεν βρέθηκαν επαφές.</p>
          )}
        </div>
      )}

      {/* Create new contact */}
      {mode === 'create' && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Νέα Επαφή</h3>
            <button type="button" onClick={() => openMode('none')} className="h-6 w-6 flex items-center justify-center rounded hover:bg-border/10 text-text-secondary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Όνομα <span className="text-danger">*</span></label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Τηλέφωνο</label>
              <input
                className="input w-full"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input
                type="email"
                className="input w-full"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Ρόλος</label>
              <RoleSelect tenantId={tenantId} value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => openMode('none')} className="btn-secondary cursor-pointer">Ακύρωση</button>
            <button type="submit" disabled={saving} className="btn-primary cursor-pointer">
              {saving ? 'Αποθήκευση…' : 'Δημιουργία & Προσθήκη'}
            </button>
          </div>
        </form>
      )}

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-text-secondary">Φόρτωση…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-text-secondary">Δεν υπάρχουν επαφές σε αυτή την υπόθεση.</p>
      ) : (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Όνομα</th>
                <th className="text-left px-4 py-2.5 font-medium">Ρόλος</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Τηλέφωνο</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {contacts.map((c) => (
                <tr key={c.contact_id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{c.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{c.role ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary hidden sm:table-cell">{c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => removeContact(c.contact_id)}
                      disabled={removing === c.contact_id}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
