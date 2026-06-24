import { supabase } from '../../lib/supabase';
import type { Call, CallFormData } from './types';

export async function fetchCalls(tenantId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
  }));
}

export async function fetchCallsForMonth(tenantId: string, year: number, month: number): Promise<Call[]> {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const toDate = new Date(year, month + 1, 1);
  const to = toDate.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title)')
    .eq('tenant_id', tenantId)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
  }));
}

export async function fetchUnlinkedCalls(tenantId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('id, phone, caller_name, direction, description, follow_up_required, follow_up_notes, created_at')
    .eq('tenant_id', tenantId)
    .is('case_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, case_code: null, case_title: null }));
}

export async function searchContactsForCall(
  tenantId: string,
  query: string,
): Promise<{ id: string; name: string; phone: string | null; email: string | null }[]> {
  if (query.trim().length < 2) return [];
  const { data } = await supabase
    .from('contacts')
    .select('id, name, phone, email')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order('name')
    .limit(5);
  return data ?? [];
}

export async function searchCasesForCall(
  tenantId: string,
  query: string,
): Promise<{ id: string; code: string; title: string; client_name?: string }[]> {
  // Search by case code/title
  const { data: byCase } = await supabase
    .from('cases')
    .select('id, code, title, clients(name)')
    .eq('tenant_id', tenantId)
    .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(10);

  // Search by client name
  const { data: clientMatches } = await supabase
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${query}%`)
    .limit(10);

  let byClient: typeof byCase = [];
  if (clientMatches && clientMatches.length > 0) {
    const clientIds = clientMatches.map((c: any) => c.id);
    const { data } = await supabase
      .from('cases')
      .select('id, code, title, clients(name)')
      .eq('tenant_id', tenantId)
      .in('client_id', clientIds)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(10);
    byClient = data ?? [];
  }

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: { id: string; code: string; title: string; client_name?: string }[] = [];
  for (const row of [...(byCase ?? []), ...(byClient ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push({
      id: row.id,
      code: row.code,
      title: row.title,
      client_name: (row as any).clients?.name ?? undefined,
    });
  }
  return merged.slice(0, 10);
}

export async function searchCalls(tenantId: string, query: string): Promise<Call[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title)')
    .eq('tenant_id', tenantId)
    .or(`caller_name.ilike.%${query}%,phone.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
  }));
}

export async function createCall(_tenantId: string, form: CallFormData): Promise<string> {
  const { data, error } = await supabase.functions.invoke('call-create', { body: form });
  if (error) throw error;
  return data.id;
}

export async function linkCallToCase(callId: string, caseId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('call-link-case', { body: { call_id: callId, case_id: caseId } });
  if (error) throw error;
}

export type CallUpdateData = {
  phone?: string;
  email?: string;
  caller_name?: string;
  direction?: import('./types').CallDirection;
  description?: string;
  follow_up_required?: boolean;
  follow_up_done?: boolean;
  follow_up_notes?: string;
  case_id?: string | null;
  contact_id?: string | null;
  created_at?: string;
};

export async function searchCallsForLinking(tenantId: string, query: string): Promise<Call[]> {
  const q = query.trim();
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title)')
    .eq('tenant_id', tenantId)
    .is('contact_id', null)
    .or(`caller_name.ilike.%${q}%,phone.ilike.%${q}%,description.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
  }));
}

export async function updateCall(callId: string, data: CallUpdateData): Promise<void> {
  const { error } = await supabase.functions.invoke('call-update', { body: { id: callId, ...data } });
  if (error) throw error;
}

export async function fetchCall(callId: string): Promise<Call | null> {
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title), contacts(name, phone)')
    .eq('id', callId)
    .single();
  if (error) return null;
  return {
    ...data,
    case_code: data.cases?.code ?? null,
    case_title: data.cases?.title ?? null,
  };
}

export async function fetchCallsByContact(contactId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*, cases(code, title)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    case_code: r.cases?.code ?? null,
    case_title: r.cases?.title ?? null,
  }));
}

function callToAthens(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hour12: false });
  return { date, time };
}

export async function syncCallToCalendar(call: { id: string; caller_name: string | null; phone: string | null; direction: string; description: string | null; created_at: string }): Promise<void> {
  const dirLabel = call.direction === 'inperson' ? 'Συνάντηση' : call.direction === 'email' ? 'Email' : 'Κλήση';
  const calTitle = `${dirLabel}: ${call.caller_name || call.phone || 'Άγνωστος'}`;
  const { date, time } = callToAthens(call.created_at);
  const { error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'create', callId: call.id, title: calTitle, description: call.description, due_date: date, due_time: time },
  });
  if (error) throw error;
}

export async function deleteCall(callId: string): Promise<void> {
  const { data } = await supabase.from('calls').select('google_event_id').eq('id', callId).single();
  if (data?.google_event_id) {
    await supabase.functions.invoke('google-calendar-sync', { body: { action: 'delete', google_event_id: data.google_event_id } });
  }
  const { error } = await supabase.from('calls').delete().eq('id', callId);
  if (error) throw error;
}
