import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../auth';

type GoogleContact = {
  resourceName: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
};

type ImportStatus = 'idle' | 'fetching' | 'ready' | 'importing' | 'done' | 'error' | 'no_token';

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^00/, '+');
}

async function fetchGoogleContacts(token: string): Promise<GoogleContact[]> {
  let all: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Google API error: ${res.status}`);
    const json = await res.json();

    for (const p of json.connections ?? []) {
      const name = p.names?.[0]?.displayName?.trim();
      if (!name) continue;
      const phones: string[] = (p.phoneNumbers ?? []).map((ph: any) => normalizePhone(ph.value ?? ''));
      const emails: string[] = (p.emailAddresses ?? []).map((em: any) => (em.value ?? '').toLowerCase().trim());
      all.push({
        resourceName: p.resourceName,
        name,
        phone: phones[0] ?? null,
        phone2: phones[1] ?? null,
        email: emails[0] ?? null,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return all.sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export default function GoogleImportModal({ open, onClose, onImported }: Props) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStatus('fetching');
    setError(null);
    setSelected(new Set());

    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.provider_token;
      if (!token) {
        setStatus('no_token');
        return;
      }
      try {
        const list = await fetchGoogleContacts(token);
        setContacts(list);
        setSelected(new Set(list.map((c) => c.resourceName)));
        setStatus('ready');
      } catch (e: any) {
        setError(e.message ?? 'Αποτυχία φόρτωσης επαφών.');
        setStatus('error');
      }
    });
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.resourceName)));
  };

  const handleImport = async () => {
    if (!tenantId || selected.size === 0) return;
    setStatus('importing');
    setError(null);

    const toImport = contacts.filter((c) => selected.has(c.resourceName));

    // Fetch existing phones/emails to skip true duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('phone, email')
      .eq('tenant_id', tenantId);

    const existingPhones = new Set((existing ?? []).map((c) => c.phone).filter(Boolean));
    const existingEmails = new Set((existing ?? []).map((c) => c.email).filter(Boolean));

    const rows = toImport
      .filter((c) => {
        if (c.phone && existingPhones.has(c.phone)) return false;
        if (c.email && existingEmails.has(c.email)) return false;
        return true;
      })
      .map((c) => ({
        tenant_id: tenantId,
        name: c.name,
        phone: c.phone,
        phone2: c.phone2,
        email: c.email,
      }));

    if (rows.length === 0) {
      setImportedCount(0);
      setStatus('done');
      return;
    }

    const { error: insertError } = await supabase.from('contacts').insert(rows);
    if (insertError) {
      setError(insertError.message);
      setStatus('error');
      return;
    }

    setImportedCount(rows.length);
    setStatus('done');
    onImported();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-secondary-background rounded-2xl border border-border/10 shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-border/10">
          <h2 className="text-lg font-semibold text-text-primary">Εισαγωγή από Google Contacts</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {status === 'fetching' && (
            <p className="text-sm text-text-secondary">Φόρτωση επαφών από Google…</p>
          )}

          {status === 'no_token' && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Δεν βρέθηκε Google token. Αυτό συμβαίνει όταν η σύνδεση έγινε με email/password ή έχει λήξει η Google session.
              </p>
              <p className="text-sm text-text-secondary">
                Αποσυνδεθείτε και συνδεθείτε ξανά με Google για να έχετε πρόσβαση στις επαφές σας.
              </p>
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-danger">{error}</p>
          )}

          {status === 'done' && (
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-text-primary">Ολοκληρώθηκε!</p>
              <p className="text-sm text-text-secondary">
                {importedCount === 0
                  ? 'Δεν εισήχθησαν νέες επαφές (όλες υπήρχαν ήδη).'
                  : `Εισήχθησαν ${importedCount} νέες επαφές.`}
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-secondary">{contacts.length} επαφές βρέθηκαν</span>
                <button onClick={toggleAll} className="text-xs text-primary hover:underline cursor-pointer">
                  {selected.size === contacts.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                </button>
              </div>
              {contacts.map((c) => (
                <label
                  key={c.resourceName}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-border/10 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.resourceName)}
                    onChange={() => toggle(c.resourceName)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{c.name}</p>
                    <p className="text-xs text-text-secondary truncate">
                      {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {status === 'importing' && (
            <p className="text-sm text-text-secondary">Εισαγωγή {selected.size} επαφών…</p>
          )}
        </div>

        <div className="p-6 border-t border-border/10 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary cursor-pointer">
            {status === 'done' ? 'Κλείσιμο' : 'Ακύρωση'}
          </button>
          {status === 'ready' && (
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="btn-primary cursor-pointer disabled:opacity-50"
            >
              Εισαγωγή {selected.size} επαφών
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
