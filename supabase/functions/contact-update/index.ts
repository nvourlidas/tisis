import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, ...fields } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)
    const { error } = await supabase.from('contacts').update(fields).eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
