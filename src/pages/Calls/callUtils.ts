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

export async function lookupContactByPhone(
  tenantId: string,
  phone: string,
): Promise<{ id: string; name: string } | null> {
  if (phone.length < 4) return null;
  const { data } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('phone', `%${phone}%`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function searchCasesForCall(
  tenantId: string,
  query: string,
): Promise<{ id: string; code: string; title: string }[]> {
  const { data } = await supabase
    .from('cases')
    .select('id, code, title')
    .eq('tenant_id', tenantId)
    .or(`code.ilike.%${query}%,title.ilike.%${query}%`)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(10);
  return data ?? [];
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
