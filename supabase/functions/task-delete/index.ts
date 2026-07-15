import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { syncCalendar } from '../_shared/calendarSync.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const { data: task } = await supabase.from('tasks').select('google_event_id').eq('id', id).eq('tenant_id', tenantId).single()

    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)

    if (task?.google_event_id) {
      await syncCalendar(
        Deno.env.get('SUPABASE_URL')!,
        req.headers.get('Authorization')!,
        { action: 'delete', google_event_id: task.google_event_id },
      )
    }
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
