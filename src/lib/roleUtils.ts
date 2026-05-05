import { supabase } from './supabase';

export type ContactRole = { id: string; name: string; color: string };

export async function fetchContactRoles(tenantId: string): Promise<ContactRole[]> {
  const { data, error } = await supabase
    .from('contact_roles')
    .select('id, name, color')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createContactRole(tenantId: string, name: string, color: string): Promise<ContactRole> {
  const { data, error } = await supabase
    .from('contact_roles')
    .insert({ tenant_id: tenantId, name: name.trim(), color })
    .select('id, name, color')
    .single();
  if (error) throw error;
  return data;
}

export async function updateContactRoleColor(id: string, color: string): Promise<void> {
  const { error } = await supabase.from('contact_roles').update({ color }).eq('id', id);
  if (error) throw error;
}

export async function deleteContactRole(id: string): Promise<void> {
  const { error } = await supabase.from('contact_roles').delete().eq('id', id);
  if (error) throw error;
}
