import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { call_id, case_id } = await req.json()
    if (!call_id || !case_id) return json({ error: 'call_id and case_id are required' }, 400)
    const { error } = await supabase.from('calls').update({ case_id }).eq('id', call_id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
