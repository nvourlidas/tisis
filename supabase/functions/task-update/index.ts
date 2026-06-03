import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { syncCalendar } from '../_shared/calendarSync.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, title, description, due_date, due_time, case_id, category, extra_data, fee, expenses, linked_task_ids } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)
    if (!title?.trim()) return json({ error: 'title is required' }, 400)
    const { error } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        due_time: due_time || null,
        case_id: case_id || null,
        category: category || null,
        extra_data: extra_data || null,
        fee: fee ?? null,
        expenses: expenses?.length ? expenses : null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)

    // Sync task links: replace all links for this task
    if (linked_task_ids !== undefined) {
      // Remove all existing links for this task (both directions)
      await supabase.from('task_links').delete().eq('task_id', id).eq('tenant_id', tenantId)
      await supabase.from('task_links').delete().eq('linked_task_id', id).eq('tenant_id', tenantId)

      if (linked_task_ids.length) {
        const rows = linked_task_ids.flatMap((lid: string) => [
          { tenant_id: tenantId, task_id: id, linked_task_id: lid },
          { tenant_id: tenantId, task_id: lid, linked_task_id: id },
        ])
        await supabase.from('task_links').upsert(rows, { onConflict: 'task_id,linked_task_id', ignoreDuplicates: true })
      }
    }

    const { data: task } = await supabase.from('tasks').select('google_event_id').eq('id', id).single()
    await syncCalendar(
      Deno.env.get('SUPABASE_URL')!,
      req.headers.get('Authorization')!,
      { action: 'update', google_event_id: task?.google_event_id, title: title.trim(), description: description || null, due_date: due_date || null, due_time: due_time || null },
    )
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
