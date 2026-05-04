import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const { data: existing } = await supabase
      .from('contacts')
      .select('google_resource_name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { error } = await supabase.from('contacts').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)

    if (existing?.google_resource_name) {
      try {
        const authHeader = req.headers.get('Authorization')!
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-contact-sync`, {
          method: 'POST',
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', resourceName: existing.google_resource_name }),
        })
      } catch (e: any) {
        console.warn('Google sync failed:', e.message)
      }
    }

    return json({ ok: true })
  } catch (e: any) { return json({ error: e.message }, 500) }
})
