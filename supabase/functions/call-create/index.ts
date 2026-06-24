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
    const { phone, email, caller_name, direction, case_id, contact_id, description, follow_up_required, follow_up_notes, no_case_intentional, create_task, task_title, task_due_date, created_at } = await req.json()

    const { data: call, error } = await supabase
      .from('calls')
      .insert({ tenant_id: tenantId, phone: phone || null, email: email || null, caller_name: caller_name || null, direction: direction || 'phone', case_id: case_id || null, contact_id: contact_id || null, description: description || null, follow_up_required: follow_up_required ?? false, follow_up_notes: follow_up_notes || null, no_case_intentional: no_case_intentional ?? false, ...(created_at ? { created_at } : {}) })
      .select('id, created_at').single()
    if (error) return json({ error: error.message }, 400)

    if (create_task && task_title?.trim()) {
      await supabase.from('tasks').insert({ tenant_id: tenantId, case_id: case_id || null, source_call_id: call.id, title: task_title.trim(), due_date: task_due_date || null, status: 'open' })
    }

    const { date: callDate, time: callTime } = toAthens(call.created_at)
    const dirLabel = direction === 'inperson' ? 'Συνάντηση' : direction === 'email' ? 'Email' : 'Κλήση'
    const calTitle = `${dirLabel}: ${caller_name || phone || 'Άγνωστος'}`
    await syncCalendar(
      Deno.env.get('SUPABASE_URL')!,
      req.headers.get('Authorization')!,
      { action: 'create', callId: call.id, title: calTitle, description: description || null, due_date: callDate, due_time: callTime },
    )

    return json(call)
  } catch (e) { return json({ error: e.message }, 500) }
})
