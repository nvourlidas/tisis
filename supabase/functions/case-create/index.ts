import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

async function createDriveFolder(supabaseUrl: string, authHeader: string, caseId: string, folderName: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/google-drive-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ action: 'create-folder', caseId, folderName }),
    })
  } catch (_) { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { code, title, client_id, status, stage_id, description, next_critical_date, google_drive_url, notes, created_at } = await req.json()
    if (!code?.trim() || !title?.trim()) return json({ error: 'code and title are required' }, 400)
    const { data, error } = await supabase
      .from('cases')
      .insert({ tenant_id: tenantId, code: code.trim(), title: title.trim(), client_id: client_id || null, status: status || 'active', stage_id: stage_id || null, description: description || null, next_critical_date: next_critical_date || null, google_drive_url: google_drive_url || null, notes: notes || null, ...(created_at ? { created_at } : {}) })
      .select().single()
    if (error) return json({ error: error.message }, 400)
    await createDriveFolder(
      Deno.env.get('SUPABASE_URL')!,
      req.headers.get('Authorization')!,
      data.id,
      `${data.code} — ${data.title}`,
    )
    return json(data)
  } catch (e) { return json({ error: e.message }, 500) }
})
