import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { name, phone, email, role, notes } = await req.json()
    if (!name?.trim()) return json({ error: 'Name is required' }, 400)
    const { data, error } = await supabase
      .from('contacts')
      .insert({ tenant_id: tenantId, name: name.trim(), phone: phone || null, email: email || null, role: role || null, notes: notes || null })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
