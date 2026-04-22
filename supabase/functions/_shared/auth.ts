import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

export async function authenticate(req: Request): Promise<
  { tenantId: string; role: string; supabase: ReturnType<typeof adminClient> } | Response
> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = adminClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single()

  if (!tu) return json({ error: 'No tenant' }, 403)

  return { tenantId: tu.tenant_id, role: tu.role, supabase }
}
