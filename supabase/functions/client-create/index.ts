import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { name, phone, phone2, email, vat, address, professional_status, notes } = await req.json()
    if (!name?.trim()) return json({ error: 'Name is required' }, 400)
    const { data, error } = await supabase
      .from('clients')
      .insert({ tenant_id: tenantId, name: name.trim(), phone: phone || null, phone2: phone2 || null, email: email || null, vat: vat || null, address: address || null, professional_status: professional_status || null, notes: notes || null })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
