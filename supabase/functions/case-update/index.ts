import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

const ALLOWED = ['code', 'title', 'client_id', 'status', 'type', 'stage_id', 'description', 'next_critical_date', 'google_drive_url', 'notes', 'created_at']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, ...incoming } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const fields: Record<string, unknown> = {}
    for (const key of ALLOWED) {
      if (!(key in incoming)) continue
      const v = incoming[key]
      fields[key] = v === '' ? null : v
    }

    const { error } = await supabase.from('cases').update(fields).eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e: any) { return json({ error: e.message }, 500) }
})
