import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { syncCalendar } from '../_shared/calendarSync.ts'

function toAthens(isoString: string): { date: string; time: string } {
  const d = new Date(isoString)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' })
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, phone, email, caller_name, direction, description, follow_up_required, follow_up_done, follow_up_notes, case_id, contact_id, created_at } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const updates: Record<string, unknown> = {}
    if (phone !== undefined) updates.phone = phone || null
    if (email !== undefined) updates.email = email || null
    if (caller_name !== undefined) updates.caller_name = caller_name || null
    if (direction !== undefined) updates.direction = direction
    if (description !== undefined) updates.description = description || null
    if (follow_up_required !== undefined) updates.follow_up_required = follow_up_required
    if (follow_up_done !== undefined) updates.follow_up_done = follow_up_done
    if (follow_up_notes !== undefined) updates.follow_up_notes = follow_up_notes || null
    if (case_id !== undefined) updates.case_id = case_id || null
    if (contact_id !== undefined) updates.contact_id = contact_id || null
    if (created_at !== undefined) updates.created_at = created_at

    const { error } = await supabase.from('calls').update(updates).eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)

    const { data: call } = await supabase.from('calls').select('google_event_id, caller_name, phone, direction, description, created_at').eq('id', id).single()
    if (call?.google_event_id) {
      const { date: callDate, time: callTime } = toAthens(call.created_at as string)
      const dirLabel = call.direction === 'inperson' ? 'Συνάντηση' : call.direction === 'email' ? 'Email' : 'Κλήση'
      const calTitle = `${dirLabel}: ${call.caller_name || call.phone || 'Άγνωστος'}`
      await syncCalendar(
        Deno.env.get('SUPABASE_URL')!,
        req.headers.get('Authorization')!,
        { action: 'update', google_event_id: call.google_event_id, title: calTitle, description: call.description, due_date: callDate, due_time: callTime },
      )
    }

    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
