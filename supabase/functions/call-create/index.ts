import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { phone, caller_name, direction, case_id, contact_id, description, follow_up_required, no_case_intentional, create_task, task_title, task_due_date, created_at } = await req.json()

    const { data: call, error } = await supabase
      .from('calls')
      .insert({ tenant_id: tenantId, phone: phone || null, caller_name: caller_name || null, direction: direction || 'phone', case_id: case_id || null, contact_id: contact_id || null, description: description || null, follow_up_required: follow_up_required ?? false, no_case_intentional: no_case_intentional ?? false, ...(created_at ? { created_at } : {}) })
      .select('id').single()
    if (error) return json({ error: error.message }, 400)

    if (create_task && task_title?.trim()) {
      await supabase.from('tasks').insert({ tenant_id: tenantId, case_id: case_id || null, source_call_id: call.id, title: task_title.trim(), due_date: task_due_date || null, status: 'open' })
    }

    return json(call)
  } catch (e) { return json({ error: e.message }, 500) }
})
