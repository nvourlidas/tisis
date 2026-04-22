import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { code, title, client_id, status, stage, description, next_critical_date, google_drive_url, notes } = await req.json()
    if (!code?.trim() || !title?.trim()) return json({ error: 'code and title are required' }, 400)
    const { data, error } = await supabase
      .from('cases')
      .insert({ tenant_id: tenantId, code: code.trim(), title: title.trim(), client_id: client_id || null, status: status || 'active', stage: stage || null, description: description || null, next_critical_date: next_critical_date || null, google_drive_url: google_drive_url || null, notes: notes || null })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
