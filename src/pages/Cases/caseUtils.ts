import { supabase } from '../../lib/supabase';
import type { Case, CaseFormData, CaseContact, CaseContactEmail, CaseCall, CaseTask, CaseFee, CaseExpense, CaseStatus, CaseStage } from './types';

const CASE_SELECT = '*, clients(name, email), case_stages(name)';
function mapCase(r: any): Case {
  return { ...r, client_name: r.clients?.name ?? null, client_email: r.clients?.email ?? null, stage_name: r.case_stages?.name ?? null };
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
  const [byCase, byClient] = await Promise.all([
    supabase
      .from('cases')
      .select(CASE_SELECT)
      .eq('tenant_id', tenantId)
      .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${query}%`)
      .limit(50),
  ]);
  if (byCase.error) throw byCase.error;
  if (byClient.error) throw byClient.error;

  const clientIds = (byClient.data ?? []).map((c: any) => c.id);
  let extra: Case[] = [];
  if (clientIds.length > 0) {
    const { data, error } = await supabase
      .from('cases')
      .select(CASE_SELECT)
      .eq('tenant_id', tenantId)
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    extra = (data ?? []).map(mapCase);
  }

  const seen = new Set<string>();
  const merged: Case[] = [];
  for (const c of [...(byCase.data ?? []).map(mapCase), ...extra]) {
    if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
  }
  return merged;
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

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id);
  if (error) throw error;
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
    .select('contact_id, role, contacts(name, phone, email)')
    .eq('case_id', caseId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    contact_id: r.contact_id,
    name: r.contacts?.name,
    phone: r.contacts?.phone ?? null,
    email: r.contacts?.email ?? null,
    role: r.role ?? null,
  }));
}

export async function fetchCaseContactEmails(caseId: string): Promise<CaseContactEmail[]> {
  const { data, error } = await supabase
    .from('case_contacts')
    .select('contacts(name, email, email2, email3, email4)')
    .eq('case_id', caseId);
  if (error) throw error;
  const out: CaseContactEmail[] = [];
  for (const r of (data ?? []) as any[]) {
    const c = r.contacts;
    if (!c) continue;
    for (const email of [c.email, c.email2, c.email3, c.email4]) {
      if (email) out.push({ label: c.name, email });
    }
  }
  return out;
}

export async function addContactToCase(caseId: string, contactId: string, role?: string): Promise<void> {
  const { error } = await supabase
    .from('case_contacts')
    .insert({ case_id: caseId, contact_id: contactId, role: role || null });
  if (error) throw error;
}

export async function updateCaseContactRole(caseId: string, contactId: string, role: string | null): Promise<void> {
  const { error } = await supabase
    .from('case_contacts')
    .update({ role: role || null })
    .eq('case_id', caseId)
    .eq('contact_id', contactId);
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
    .select('id, title, description, due_date, due_time, status, completed_at, created_at, category, extra_data, hours, fee_id')
    .eq('case_id', caseId)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    due_date: r.due_date ? r.due_date.slice(0, 10) : null,
    due_time: r.due_time ?? null,
    category: r.category ?? null,
    extra_data: r.extra_data ?? null,
    hours: r.hours ?? null,
    fee_id: r.fee_id ?? null,
  }));
}

export async function linkTaskToFee(taskId: string, feeId: string | null): Promise<void> {
  const { error } = await supabase.from('tasks').update({ fee_id: feeId }).eq('id', taskId);
  if (error) throw error;
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-complete', { body: { id } });
  if (error) throw error;
}

export async function reopenTask(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('task-reopen', { body: { id } });
  if (error) throw error;
}

// --- Case Fees ---
export async function fetchCaseFees(caseId: string): Promise<CaseFee[]> {
  const { data, error } = await supabase
    .from('case_fees')
    .select('*, fee_payments(*)')
    .eq('case_id', caseId)
    .order('agreement_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    agreement_date: r.agreement_date ?? null,
    payments: (r.fee_payments ?? []).map((p: any) => ({
      ...p,
      paid_at: p.paid_at.slice(0, 10),
    })).sort((a: any, b: any) => a.paid_at.localeCompare(b.paid_at)),
  }));
}

export async function createCaseFee(tenantId: string, caseId: string, fee: {
  amount: number;
  agreement_date: string | null;
  notes?: string;
}): Promise<CaseFee> {
  const { data, error } = await supabase
    .from('case_fees')
    .insert({ tenant_id: tenantId, case_id: caseId, ...fee, notes: fee.notes || null })
    .select()
    .single();
  if (error) throw error;
  return { ...data, payments: [] };
}

export async function deleteCaseFee(id: string): Promise<void> {
  const { error } = await supabase.from('case_fees').delete().eq('id', id);
  if (error) throw error;
}

export async function createFeePayment(tenantId: string, feeId: string, payment: {
  amount: number;
  paid_at: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('fee_payments').insert({
    tenant_id: tenantId,
    fee_id: feeId,
    amount: payment.amount,
    paid_at: payment.paid_at,
    notes: payment.notes || null,
  });
  if (error) throw error;
}

export async function deleteFeePayment(id: string): Promise<void> {
  const { error } = await supabase.from('fee_payments').delete().eq('id', id);
  if (error) throw error;
}

// --- Case Expenses ---
export async function fetchCaseExpenses(caseId: string): Promise<CaseExpense[]> {
  const { data, error } = await supabase
    .from('case_expenses')
    .select('*')
    .eq('case_id', caseId)
    .order('date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, date: r.date ?? null }));
}

export async function createCaseExpense(tenantId: string, caseId: string, expense: {
  amount: number;
  date: string | null;
  notes?: string;
  drive_file_id?: string | null;
  drive_file_url?: string | null;
  drive_file_name?: string | null;
}): Promise<CaseExpense> {
  const { data, error } = await supabase.from('case_expenses').insert({
    tenant_id: tenantId,
    case_id: caseId,
    amount: expense.amount,
    date: expense.date || null,
    notes: expense.notes || null,
    drive_file_id: expense.drive_file_id ?? null,
    drive_file_url: expense.drive_file_url ?? null,
    drive_file_name: expense.drive_file_name ?? null,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCaseExpense(id: string): Promise<void> {
  const { error } = await supabase.from('case_expenses').delete().eq('id', id);
  if (error) throw error;
}
