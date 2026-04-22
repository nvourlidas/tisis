import { supabase } from '../../lib/supabase';
import type { Client, ClientFormData } from './types';

export async function fetchClients(tenantId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchClients(tenantId: string, query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function createClient(_tenantId: string, form: ClientFormData): Promise<Client> {
  const { data, error } = await supabase.functions.invoke('client-create', { body: form });
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, form: Partial<ClientFormData>): Promise<void> {
  const { error } = await supabase.functions.invoke('client-update', { body: { id, ...form } });
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('client-delete', { body: { id } });
  if (error) throw error;
}
