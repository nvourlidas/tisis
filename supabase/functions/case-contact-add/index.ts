import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { case_id, contact_id } = await req.json()
    if (!case_id || !contact_id) return json({ error: 'case_id and contact_id are required' }, 400)
    const { error } = await supabase.from('case_contacts').insert({ case_id, contact_id })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
