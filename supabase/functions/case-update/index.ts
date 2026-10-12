import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { upsertCaseBlock, removeCaseBlock } from '../_shared/caseNotes.ts'

const ALLOWED = ['code', 'title', 'client_id', 'status', 'type', 'stage_id', 'description', 'next_critical_date', 'google_drive_url', 'notes', 'created_at']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, ...incoming } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const fields: Record<string, unknown> = {}
    for (const key of ALLOWED) {
      if (!(key in incoming)) continue
      const v = incoming[key]
      fields[key] = v === '' ? null : v
    }

    const { data: existing } = await supabase
      .from('cases')
      .select('code, title, description, client_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { error } = await supabase.from('cases').update(fields).eq('id', id).eq('tenant_id', tenantId)
    if (error) return json({ error: error.message }, 400)

    if (existing) {
      const code = (fields.code as string) ?? existing.code
      const title = (fields.title as string) ?? existing.title
      const description = 'description' in fields ? (fields.description as string | null) : existing.description
      const newClientId = 'client_id' in fields ? (fields.client_id as string | null) : existing.client_id
      const clientChanged = newClientId !== existing.client_id
      const contentChanged = clientChanged || 'code' in fields || 'title' in fields || 'description' in fields

      if (contentChanged) {
        if (clientChanged && existing.client_id) {
          const { data: oldClient } = await supabase.from('clients').select('notes, contact_id').eq('id', existing.client_id).maybeSingle()
          if (oldClient) {
            const notes = removeCaseBlock(oldClient.notes, id)
            await supabase.from('clients').update({ notes }).eq('id', existing.client_id)
            if (oldClient.contact_id) {
              const { data: oldContact } = await supabase.from('contacts').select('notes').eq('id', oldClient.contact_id).maybeSingle()
              if (oldContact) {
                const contactNotes = removeCaseBlock(oldContact.notes, id)
                await supabase.from('contacts').update({ notes: contactNotes }).eq('id', oldClient.contact_id)
              }
            }
          }
        }
        if (newClientId) {
          const { data: client } = await supabase.from('clients').select('notes, contact_id').eq('id', newClientId).maybeSingle()
          if (client) {
            const notes = upsertCaseBlock(client.notes, id, code, title, description)
            await supabase.from('clients').update({ notes }).eq('id', newClientId)
            if (client.contact_id) {
              const { data: linkedContact } = await supabase.from('contacts').select('notes').eq('id', client.contact_id).maybeSingle()
              if (linkedContact) {
                const contactNotes = upsertCaseBlock(linkedContact.notes, id, code, title, description)
                await supabase.from('contacts').update({ notes: contactNotes }).eq('id', client.contact_id)
              }
            }
          }
        }

        const { data: links } = await supabase.from('case_contacts').select('contact_id').eq('case_id', id)
        for (const link of links ?? []) {
          const { data: contact } = await supabase.from('contacts').select('notes').eq('id', link.contact_id).maybeSingle()
          if (contact) {
            const notes = upsertCaseBlock(contact.notes, id, code, title, description)
            await supabase.from('contacts').update({ notes }).eq('id', link.contact_id)
          }
        }
      }
    }

    return json({ ok: true })
  } catch (e: any) { return json({ error: e.message }, 500) }
})
