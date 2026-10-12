import { corsHeaders, json, authenticate } from '../_shared/auth.ts'
import { removeCaseBlock } from '../_shared/caseNotes.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { case_id, contact_id } = await req.json()
    if (!case_id || !contact_id) return json({ error: 'case_id and contact_id are required' }, 400)
    const { error } = await supabase.from('case_contacts').delete().eq('case_id', case_id).eq('contact_id', contact_id)
    if (error) return json({ error: error.message }, 400)

    const { data: contact } = await supabase.from('contacts').select('notes').eq('id', contact_id).maybeSingle()
    if (contact) {
      const notes = removeCaseBlock(contact.notes, case_id)
      await supabase.from('contacts').update({ notes }).eq('id', contact_id)
    }

    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
