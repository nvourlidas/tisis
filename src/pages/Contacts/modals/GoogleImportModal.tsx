import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../auth';

type GoogleContact = {
  resourceName: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  organization: string | null;
  job_title: string | null;
  website: string | null;
  birthdate: string | null;
  address: string | null;
  notes: string | null;
};

type ImportStatus = 'idle' | 'fetching' | 'ready' | 'importing' | 'done' | 'error' | 'no_token';

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^00/, '+');
}

function parseBirthday(b: any): string | null {
  const d = b?.date;
  if (!d?.month || !d?.day || !d?.year) return null;
  const year = String(d.year).padStart(4, '0');
  const month = String(d.month).padStart(2, '0');
  const day = String(d.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchGoogleContacts(token: string): Promise<GoogleContact[]> {
  let all: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations,urls,birthdays,addresses,biographies');
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
        organization: p.organizations?.[0]?.name?.trim() ?? null,
        job_title: p.organizations?.[0]?.title?.trim() ?? null,
        website: p.urls?.[0]?.value?.trim() ?? null,
        birthdate: parseBirthday(p.birthdays?.[0]),
        address: p.addresses?.[0]?.streetAddress?.trim() ?? null,
        notes: p.biographies?.[0]?.value?.trim() ?? null,
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
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

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
    console.log('[Import] handleImport called, tenantId:', tenantId, 'selected:', selected.size);
    if (!tenantId || selected.size === 0) return;
    setStatus('importing');
    setError(null);

    const toImport = contacts.filter((c) => selected.has(c.resourceName));

    // Fetch existing contacts to detect duplicates and backfill google_contact_id
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, phone, email, google_contact_id')
      .eq('tenant_id', tenantId);

    const byPhone = new Map((existing ?? []).filter(c => c.phone).map(c => [c.phone, c]));
    const byEmail = new Map((existing ?? []).filter(c => c.email).map(c => [c.email, c]));

    const toInsert: typeof toImport = [];
    const toBackfill: Array<{ id: string; resourceName: string }> = [];

    for (const c of toImport) {
      const match = (c.phone && byPhone.get(c.phone)) || (c.email && byEmail.get(c.email));
      if (match) {
        if (!match.google_contact_id) toBackfill.push({ id: match.id, resourceName: c.resourceName });
      } else {
        toInsert.push(c);
      }
    }

    for (const { id, resourceName } of toBackfill) {
      await supabase.from('contacts').update({ google_contact_id: resourceName }).eq('id', id);
    }

    console.log('[Import] toInsert:', toInsert.length, 'backfill:', toBackfill.length, 'tenantId:', tenantId);

    const rows = toInsert.map((c) => ({
      tenant_id: tenantId,
      name: c.name,
      phone: c.phone,
      phone2: c.phone2,
      email: c.email,
      organization: c.organization,
      job_title: c.job_title,
      website: c.website,
      birthdate: c.birthdate,
      address: c.address,
      notes: c.notes,
      google_contact_id: c.resourceName,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('contacts').insert(rows);
      if (insertError) {
        setError(insertError.message);
        setStatus('error');
        return;
      }
    }

    setImportedCount(rows.length + toBackfill.length);
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
                  : `Ολοκληρώθηκε για ${importedCount} επαφές.`}
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-2">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" />
                <input
                  className="input w-full pl-9!"
                  placeholder="Αναζήτηση επαφής…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary">{filtered.length} επαφές</span>
                <button onClick={toggleAll} className="text-xs text-primary hover:underline cursor-pointer">
                  {selected.size === contacts.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                </button>
              </div>
              {filtered.map((c) => (
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
