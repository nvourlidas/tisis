import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { syncCalendar } from '../_shared/calendarSync.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { title, description, due_date, case_id, contact_id, source_call_id, category, extra_data, fee, expenses } = await req.json()
    if (!title?.trim()) return json({ error: 'title is required' }, 400)
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        tenant_id: tenantId,
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        case_id: case_id || null,
        contact_id: contact_id || null,
        source_call_id: source_call_id || null,
        category: category || null,
        extra_data: extra_data || null,
        fee: fee ?? null,
        expenses: expenses?.length ? expenses : null,
        status: 'open',
      })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    await syncCalendar(
      Deno.env.get('SUPABASE_URL')!,
      req.headers.get('Authorization')!,
      { action: 'create', taskId: data.id, title: data.title, description: data.description, due_date: data.due_date },
    )
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
