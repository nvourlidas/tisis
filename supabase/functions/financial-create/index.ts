import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { case_id, type, amount, description, date } = await req.json()
    if (!case_id || !type || amount == null) return json({ error: 'case_id, type, and amount are required' }, 400)
    if (!['fee', 'expense', 'receipt'].includes(type)) return json({ error: 'Invalid type' }, 400)
    const { data, error } = await supabase
      .from('financials')
      .insert({ tenant_id: tenantId, case_id, type, amount: Number(amount), description: description || null, date: date || null })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
