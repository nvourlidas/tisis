import { supabase } from '../../lib/supabase';
import type { Case, CaseFormData, CaseContact, CaseCall, CaseTask, CaseFinancial, CaseStatus, CaseStage } from './types';

const CASE_SELECT = '*, clients(name), case_stages(name)';
function mapCase(r: any): Case {
  return { ...r, client_name: r.clients?.name ?? null, stage_name: r.case_stages?.name ?? null };
}

export async function fetchCases(tenantId: string, status?: CaseStatus): Promise<Case[]> {
  const BATCH = 1000;
  const all: Case[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from('cases')
      .select(CASE_SELECT)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, from + BATCH - 1);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data ?? []).map(mapCase));
    if (!data || data.length < BATCH) break;
    from += BATCH;
  }
  return all;
}

export async function fetchCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from('cases')
    .select(CASE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCase(data);
}

export async function searchCases(tenantId: string, query: string): Promise<Case[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(CASE_SELECT)
    .eq('tenant_id', tenantId)
    .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map(mapCase);
}

// --- Stages ---
export async function fetchStages(tenantId: string): Promise<CaseStage[]> {
  const { data, error } = await supabase
    .from('case_stages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStage(tenantId: string, name: string, position = 0): Promise<CaseStage> {
  const { data, error } = await supabase
    .from('case_stages')
    .insert({ tenant_id: tenantId, name, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase.from('case_stages').delete().eq('id', id);
  if (error) throw error;
}

export async function nextCaseCode(tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('cases')
    .select('code')
    .eq('tenant_id', tenantId);
  const codes = (data ?? []).map((r: any) => r.code).filter((c: string) => /^\d{4,}$/.test(c)).map(Number);
  const max = codes.length > 0 ? Math.max(...codes) : 999;
  return String(Math.max(max + 1, 1000));
}

export async function createCase(_tenantId: string, form: CaseFormData): Promise<Case> {
  const { data, error } = await supabase.functions.invoke('case-create', { body: form });
  if (error) throw error;
  return data;
}

export async function updateCase(id: string, form: Partial<CaseFormData>): Promise<void> {
  const sanitized: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(form)) {
    sanitized[k] = v === '' ? null : v;
  }
  const { error } = await supabase.functions.invoke('case-update', { body: sanitized });
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
    .select('id, title, description, due_date, status, completed_at, created_at, category, extra_data, fee, expenses')
    .eq('case_id', caseId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    due_date: r.due_date ? r.due_date.slice(0, 10) : null,
    category: r.category ?? null,
    extra_data: r.extra_data ?? null,
    fee: r.fee ?? null,
    expenses: r.expenses ?? null,
  }));
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
