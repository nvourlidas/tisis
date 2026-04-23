import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, UserPlus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchCaseContacts, addContactToCase, removeContactFromCase } from '../caseUtils';
import type { CaseContact } from '../types';

type Props = { caseId: string; tenantId: string };

type ContactOption = { id: string; name: string; phone: string | null; role: string | null };

export default function CaseContacts({ caseId, tenantId }: Props) {
  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchCaseContacts(caseId).then(setContacts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId]);

  useEffect(() => {
    if (!showAdd || !searchQ.trim()) { setOptions([]); return; }
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
  }, [searchQ, showAdd, tenantId, contacts]);

  const addContact = async (contactId: string) => {
    await addContactToCase(caseId, contactId);
    setShowAdd(false);
    setSearchQ('');
    setOptions([]);
    load();
  };

  const removeContact = async (contactId: string) => {
    setRemoving(contactId);
    try {
      await removeContactFromCase(caseId, contactId);
      setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{contacts.length} επαφές</span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn-secondary inline-flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Προσθήκη Επαφής
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-border/10 bg-secondary-background p-4 space-y-3">
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
                  onClick={() => addContact(opt.id)}
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
            <p className="text-xs text-text-secondary">Δεν βρέθηκαν επαφές. Δημιουργήστε τη στη σελίδα Επαφές.</p>
          )}
        </div>
      )}

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
