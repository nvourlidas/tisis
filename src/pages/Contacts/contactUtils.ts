import { supabase } from '../../lib/supabase';
import type { Contact, ContactFormData, ContactCase } from './types';

export async function fetchContacts(tenantId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data ?? [];
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
    .select('case_id, cases(code, title, status)')
    .eq('contact_id', contactId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    case_id: row.case_id,
    code: row.cases?.code ?? '',
    title: row.cases?.title ?? '',
    status: row.cases?.status ?? '',
  }));
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
