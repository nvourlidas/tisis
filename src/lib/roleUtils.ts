import { supabase } from './supabase';

export type ContactRole = { id: string; name: string };

export async function fetchContactRoles(tenantId: string): Promise<ContactRole[]> {
  const { data, error } = await supabase
    .from('contact_roles')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createContactRole(tenantId: string, name: string): Promise<ContactRole> {
  const { data, error } = await supabase
    .from('contact_roles')
    .insert({ tenant_id: tenantId, name: name.trim() })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContactRole(id: string): Promise<void> {
  const { error } = await supabase.from('contact_roles').delete().eq('id', id);
  if (error) throw error;
}
