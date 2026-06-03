import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Search, UserPlus, X, Users, RotateCcw, Pencil, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchCaseContacts, addContactToCase, removeContactFromCase, updateCaseContactRole } from '../caseUtils';
import { createContact } from '../../Contacts/contactUtils';
import { fetchContactRoles } from '../../../lib/roleUtils';
import RoleSelect from '../../../components/RoleSelect';
import NewContactModal from '../../Contacts/modals/NewContactModal';
import type { CaseContact } from '../types';
import type { ContactRole } from '../../../lib/roleUtils';
import type { ContactFormData } from '../../Contacts/types';

type Props = { caseId: string; tenantId: string };
type ContactOption = { id: string; name: string; phone: string | null };
type Mode = 'none' | 'search';

export default function CaseContacts({ caseId, tenantId }: Props) {
  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('none');
  const [removing, setRemoving] = useState<string | null>(null);

  // Search existing
  const [searchQ, setSearchQ] = useState('');
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingContact, setPendingContact] = useState<ContactOption | null>(null);
  const [addRole, setAddRole] = useState('');
  const [saving, setSaving] = useState(false);

  // New contact modal
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<{ id: string; name: string } | null>(null);
  const [newContactRole, setNewContactRole] = useState('');
  const [savingNewRole, setSavingNewRole] = useState(false);

  // Inline role editing
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const [roles, setRoles] = useState<ContactRole[]>([]);
  const roleMap = useMemo(() => new Map(roles.map(r => [r.name, r])), [roles]);

  const load = () => {
    setLoading(true);
    fetchCaseContacts(caseId).then(setContacts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);
  useEffect(() => { fetchContactRoles(tenantId).then(setRoles); }, [tenantId]);

  useEffect(() => {
    if (mode !== 'search' || !searchQ.trim()) { setOptions([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${searchQ.trim()}%`)
        .limit(10);
      const existing = new Set(contacts.map((c) => c.contact_id));
      setOptions((data ?? []).filter((c: ContactOption) => !existing.has(c.id)));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ, mode, tenantId, contacts]);

  const closeSearch = () => {
    setMode('none');
    setSearchQ('');
    setOptions([]);
    setPendingContact(null);
    setAddRole('');
  };

  const selectContact = (opt: ContactOption) => {
    setPendingContact(opt);
    setOptions([]);
  };

  const confirmAddExisting = async () => {
    if (!pendingContact) return;
    setSaving(true);
    try {
      await addContactToCase(caseId, pendingContact.id, addRole || undefined);
      closeSearch();
      load();
    } finally {
      setSaving(false);
    }
  };

  // Called when NewContactModal submits — create contact, then show role picker
  const handleNewContactSubmit = async (form: ContactFormData) => {
    const created = await createContact(tenantId, form);
    await addContactToCase(caseId, created.id);
    setNewlyCreated({ id: created.id, name: created.name });
    setNewContactRole('');
    load();
  };

  const confirmNewContactRole = async () => {
    if (!newlyCreated) return;
    setSavingNewRole(true);
    try {
      if (newContactRole) {
        await updateCaseContactRole(caseId, newlyCreated.id, newContactRole);
        setContacts(prev => prev.map(c => c.contact_id === newlyCreated.id ? { ...c, role: newContactRole } : c));
      }
      setNewlyCreated(null);
    } finally {
      setSavingNewRole(false);
    }
  };

  const startEditRole = (contactId: string, currentRole: string | null) => {
    setEditingRoleFor(contactId);
    setEditRoleValue(currentRole ?? '');
  };

  const saveRole = async (contactId: string) => {
    setSavingRole(true);
    try {
      await updateCaseContactRole(caseId, contactId, editRoleValue || null);
      setContacts(prev => prev.map(c => c.contact_id === contactId ? { ...c, role: editRoleValue || null } : c));
      setEditingRoleFor(null);
    } finally {
      setSavingRole(false);
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
            onClick={() => setMode(prev => prev === 'search' ? 'none' : 'search')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm transition-all cursor-pointer ${
              mode === 'search' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/15 text-text-secondary hover:text-text-primary hover:bg-border/5'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη υπάρχουσας
          </button>
          <button
            onClick={() => setShowNewContactModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:text-text-primary hover:bg-border/5 transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Νέα Επαφή
          </button>
        </div>
      </div>

      {/* Search existing */}
      {mode === 'search' && (
        <div className="animate-fade-in-up rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Προσθήκη υπάρχουσας επαφής</h3>
            <button onClick={closeSearch} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary cursor-pointer transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          {!pendingContact ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                <input
                  className="input w-full rounded-xl border-border/15 pl-9!"
                  placeholder="Αναζήτηση επαφής με όνομα…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  autoFocus
                />
              </div>
              {searching && <p className="text-xs text-text-secondary flex items-center gap-1.5"><RotateCcw className="h-3 w-3 animate-spin" />Αναζήτηση…</p>}
              {options.length > 0 && (
                <div className="divide-y divide-border/10 rounded-xl border border-border/10 overflow-hidden">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => selectContact(opt)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-border/5 cursor-pointer transition-colors"
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-text-primary">{opt.name}</div>
                        {opt.phone && <div className="text-xs text-text-secondary mt-0.5 font-mono">{opt.phone}</div>}
                      </div>
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQ.trim() && !searching && options.length === 0 && (
                <p className="text-xs text-text-secondary">Δεν βρέθηκαν επαφές.</p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-border/5 px-3 py-2">
                <span className="text-sm font-medium text-text-primary">{pendingContact.name}</span>
                {pendingContact.phone && <span className="text-xs text-text-secondary font-mono">{pendingContact.phone}</span>}
                <button onClick={() => { setPendingContact(null); setSearchQ(''); }} className="ml-auto text-text-secondary hover:text-danger cursor-pointer transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Ρόλος στην υπόθεση</label>
                <RoleSelect tenantId={tenantId} value={addRole} onChange={setAddRole} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setPendingContact(null); setSearchQ(''); }} className="px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:bg-border/5 cursor-pointer transition-all">Πίσω</button>
                <button onClick={confirmAddExisting} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 cursor-pointer transition-all disabled:opacity-60">
                  {saving ? 'Προσθήκη…' : 'Προσθήκη'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role picker after new contact creation */}
      {newlyCreated && (
        <div className="animate-fade-in-up rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-medium text-text-primary">
              <span className="text-primary">{newlyCreated.name}</span> προστέθηκε στην υπόθεση.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Ρόλος στην υπόθεση <span className="opacity-60">(προαιρετικό)</span></label>
            <RoleSelect tenantId={tenantId} value={newContactRole} onChange={setNewContactRole} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewlyCreated(null)} className="px-4 py-2 rounded-xl border border-border/15 text-sm text-text-secondary hover:bg-border/5 cursor-pointer transition-all">Παράλειψη</button>
            <button onClick={confirmNewContactRole} disabled={savingNewRole || !newContactRole} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 cursor-pointer transition-all disabled:opacity-60">
              {savingNewRole ? 'Αποθήκευση…' : 'Αποθήκευση ρόλου'}
            </button>
          </div>
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary animate-pulse-soft py-4">
          <RotateCcw className="h-4 w-4 animate-spin" /> Φόρτωση επαφών…
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-text-secondary">
          <div className="w-12 h-12 rounded-2xl bg-border/5 flex items-center justify-center">
            <Users className="h-6 w-6 opacity-30" />
          </div>
          <p className="text-sm">Δεν υπάρχουν επαφές σε αυτή την υπόθεση.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-border/5 border-b border-border/10 text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold">Όνομα</th>
                <th className="text-left px-4 py-3 font-semibold">Ρόλος</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Τηλέφωνο</th>
                <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {contacts.map((c) => (
                <tr key={c.contact_id} className="hover:bg-border/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                  <td className="px-4 py-3">
                    {editingRoleFor === c.contact_id ? (
                      <div className="flex items-center gap-1.5">
                        <RoleSelect tenantId={tenantId} value={editRoleValue} onChange={setEditRoleValue} />
                        <button
                          onClick={() => saveRole(c.contact_id)}
                          disabled={savingRole}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {savingRole ? <RotateCcw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => setEditingRoleFor(null)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-border/10 text-text-secondary transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditRole(c.contact_id, c.role)}
                        className="group inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {c.role ? (() => {
                          const r = roleMap.get(c.role!);
                          return r ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity group-hover:opacity-80"
                              style={{ backgroundColor: r.color + '25', color: r.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                              {c.role}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary group-hover:opacity-80 transition-opacity">{c.role}</span>
                          );
                        })() : (
                          <span className="inline-flex items-center gap-1 text-text-secondary text-xs group-hover:text-text-primary transition-colors">
                            —<Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell font-mono">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeContact(c.contact_id)}
                      disabled={removing === c.contact_id}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 text-text-secondary hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {removing === c.contact_id
                        ? <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewContactModal
        open={showNewContactModal}
        onClose={() => setShowNewContactModal(false)}
        onSubmit={handleNewContactSubmit}
        tenantId={tenantId}
        zIndex="z-[60]"
      />
    </div>
  );
}
