import { supabase } from '../../lib/supabase';
import type { Case, CaseFormData, CaseContact, CaseCall, CaseTask, CaseFinancial, CaseStatus } from './types';

export async function fetchCases(tenantId: string, status?: CaseStatus): Promise<Case[]> {
  let q = supabase
    .from('cases')
    .select('*, clients(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, client_name: r.clients?.name ?? null }));
}

export async function fetchCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from('cases')
    .select('*, clients(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, client_name: (data as any).clients?.name ?? null };
}

export async function searchCases(tenantId: string, query: string): Promise<Case[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*, clients(name)')
    .eq('tenant_id', tenantId)
    .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, client_name: r.clients?.name ?? null }));
}

export async function createCase(_tenantId: string, form: CaseFormData): Promise<Case> {
  const { data, error } = await supabase.functions.invoke('case-create', { body: form });
  if (error) throw error;
  return data;
}

export async function updateCase(id: string, form: Partial<CaseFormData>): Promise<void> {
  const { error } = await supabase.functions.invoke('case-update', { body: { id, ...form } });
  if (error) throw error;
}

// --- Contacts ---
export async function fetchCaseContacts(caseId: string): Promise<CaseContact[]> {
  const { data, error } = await supabase
    .from('case_contacts')
    .select('contact_id, contacts(name, phone, email, role)')
    .eq('case_id', caseId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    contact_id: r.contact_id,
    name: r.contacts?.name,
    phone: r.contacts?.phone ?? null,
    email: r.contacts?.email ?? null,
    role: r.contacts?.role ?? null,
  }));
}

export async function addContactToCase(caseId: string, contactId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('case-contact-add', { body: { case_id: caseId, contact_id: contactId } });
  if (error) throw error;
}

export async function removeContactFromCase(caseId: string, contactId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('case-contact-remove', { body: { case_id: caseId, contact_id: contactId } });
  if (error) throw error;
}

// --- Calls ---
export async function fetchCaseCalls(caseId: string): Promise<CaseCall[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('id, phone, caller_name, direction, description, follow_up_required, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// --- Tasks ---
export async function fetchCaseTasks(caseId: string): Promise<CaseTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, status, completed_at, created_at')
    .eq('case_id', caseId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-complete', { body: { id } });
  if (error) throw error;
}

export async function reopenTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-reopen', { body: { id } });
  if (error) throw error;
}

// --- Financials ---
export async function fetchCaseFinancials(caseId: string): Promise<CaseFinancial[]> {
  const { data, error } = await supabase
    .from('financials')
    .select('id, type, amount, description, date, created_at')
    .eq('case_id', caseId)
    .order('date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFinancial(_tenantId: string, caseId: string, entry: {
  type: 'fee' | 'expense' | 'receipt';
  amount: number;
  description: string;
  date: string;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('financial-create', { body: { case_id: caseId, ...entry } });
  if (error) throw error;
}
