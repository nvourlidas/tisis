import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, title, description, due_date, category, extra_data, fee, expenses } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)
    if (!title?.trim()) return json({ error: 'title is required' }, 400)
    const { error } = await supabase
      .from('tasks')
      .update({
        title: title.trim(),
        description: description || null,
        due_date: due_date || null,
        category: category || null,
        extra_data: extra_data || null,
        fee: fee ?? null,
        expenses: expenses?.length ? expenses : null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
