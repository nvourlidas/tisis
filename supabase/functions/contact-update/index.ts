import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const {
      id,
      name, phone, phone2, email, role, notes, vat, address, professional_status,
      father_name, mother_name, birthdate, amka, iban, at, taxis_username, taxis_password,
    } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)
    if (!name?.trim()) return json({ error: 'Name is required' }, 400)
    const { error } = await supabase
      .from('contacts')
      .update({
        name: name.trim(),
        phone: phone || null,
        phone2: phone2 || null,
        email: email || null,
        role: role || null,
        notes: notes || null,
        vat: vat || null,
        address: address || null,
        professional_status: professional_status || null,
        father_name: father_name || null,
        mother_name: mother_name || null,
        birthdate: birthdate || null,
        amka: amka || null,
        iban: iban || null,
        at: at || null,
        taxis_username: taxis_username || null,
        taxis_password: taxis_password || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
