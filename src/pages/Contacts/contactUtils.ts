import { supabase } from '../../lib/supabase';
import type { Contact, ContactFormData, ContactCase } from './types';
import type { Client } from '../Clients/types';

const AUTO_NOTES_SEPARATOR = '\n\n--- Στοιχεία TISIS ---';

type NonGoogleFields = {
  vat?: string; father_name?: string; mother_name?: string;
  amka?: string; iban?: string; at?: string;
  taxis_username?: string; taxis_password?: string;
};

function buildAutoNotesBlock(fields: NonGoogleFields): string {
  const lines: string[] = [];
  if (fields.vat) lines.push(`ΑΦΜ: ${fields.vat}`);
  if (fields.amka) lines.push(`ΑΜΚΑ: ${fields.amka}`);
  if (fields.iban) lines.push(`IBAN: ${fields.iban}`);
  if (fields.at) lines.push(`ΑΤ: ${fields.at}`);
  if (fields.father_name) lines.push(`Πατρώνυμο: ${fields.father_name}`);
  if (fields.mother_name) lines.push(`Μητρώνυμο: ${fields.mother_name}`);
  if (fields.taxis_username) lines.push(`TAXISnet χρήστης: ${fields.taxis_username}`);
  if (fields.taxis_password) lines.push(`TAXISnet κωδικός: ${fields.taxis_password}`);
  return lines.length ? AUTO_NOTES_SEPARATOR + '\n' + lines.join('\n') : '';
}

export function mergeNotesWithAutoBlock(manualNotes: string, fields: NonGoogleFields): string {
  const stripped = manualNotes.split(AUTO_NOTES_SEPARATOR)[0].trimEnd();
  const block = buildAutoNotesBlock(fields);
  return block ? stripped + block : stripped;
}

export async function fetchContacts(tenantId: string): Promise<Contact[]> {
  const BATCH = 1000;
  const all: Contact[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
      .range(from, from + BATCH - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

export async function fetchContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchContacts(tenantId: string, query: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchContactCases(contactId: string): Promise<ContactCase[]> {
  const { data, error } = await supabase
    .from('case_contacts')
    .select('case_id, role, cases(code, title, status)')
    .eq('contact_id', contactId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    case_id: row.case_id,
    code: row.cases?.code ?? '',
    title: row.cases?.title ?? '',
    status: row.cases?.status ?? '',
    role: row.role ?? null,
  }));
}

export async function fetchLinkedClient(contactId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createContact(_tenantId: string, form: ContactFormData): Promise<Contact> {
  const { data, error } = await supabase.functions.invoke('contact-create', { body: form });
  if (error) throw error;
  return data;
}

export async function updateContact(id: string, form: Partial<ContactFormData>): Promise<void> {
  const { error } = await supabase.functions.invoke('contact-update', { body: { id, ...form } });
  if (error) throw error;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('contact-delete', { body: { id } });
  if (error) throw error;
}

export async function promoteContactToClient(contact: Contact): Promise<Client> {
  const { data, error } = await supabase.functions.invoke('client-create', {
    body: {
      contact_id: contact.id,
      name: contact.name,
      phone: contact.phone ?? '',
      phone2: contact.phone2 ?? '',
      email: contact.email ?? '',
      vat: contact.vat ?? '',
      address: contact.address ?? '',
      professional_status: contact.job_title ?? '',
      notes: contact.notes ?? '',
      father_name: contact.father_name ?? '',
      mother_name: contact.mother_name ?? '',
      birthdate: contact.birthdate ?? '',
      amka: contact.amka ?? '',
      iban: contact.iban ?? '',
      at: contact.at ?? '',
      taxis_username: contact.taxis_username ?? '',
      taxis_password: contact.taxis_password ?? '',
    },
  });
  if (error) throw error;
  return data;
}
