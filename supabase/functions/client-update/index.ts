import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

const SHARED_FIELDS = [
  'name', 'phone', 'phone2', 'phone3', 'phone4',
  'email', 'email2', 'email3', 'email4',
  'vat', 'address', 'job_title', 'organization', 'website', 'notes',
  'father_name', 'mother_name', 'birthdate', 'amka', 'iban', 'at',
  'taxis_username', 'taxis_password',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const { id, ...fields } = await req.json()
    if (!id) return json({ error: 'id is required' }, 400)

    const sanitized = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === '' ? null : v])
    )

    // Fetch contact_id before updating
    const { data: existing } = await supabase
      .from('clients')
      .select('contact_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const { error: clientErr } = await supabase
      .from('clients')
      .update(sanitized)
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (clientErr) return json({ error: clientErr.message }, 400)

    if (existing?.contact_id) {
      const contactPatch = Object.fromEntries(
        Object.entries(sanitized).filter(([k]) => SHARED_FIELDS.includes(k))
      )
      if (Object.keys(contactPatch).length > 0) {
        // Fetch google_contact_id for the Google sync
        const { data: contact } = await supabase
          .from('contacts')
          .select('google_contact_id')
          .eq('id', existing.contact_id)
          .maybeSingle()

        await supabase
          .from('contacts')
          .update(contactPatch)
          .eq('id', existing.contact_id)
          .eq('tenant_id', tenantId)

        // Sync to Google Contacts
        try {
          const authHeader = req.headers.get('Authorization')!
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-contact-sync`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              contactId: existing.contact_id,
              name: sanitized.name ?? null,
              phone: sanitized.phone ?? null,
              phone2: sanitized.phone2 ?? null,
              phone3: sanitized.phone3 ?? null,
              phone4: sanitized.phone4 ?? null,
              email: sanitized.email ?? null,
              email2: sanitized.email2 ?? null,
              email3: sanitized.email3 ?? null,
              email4: sanitized.email4 ?? null,
              organization: sanitized.organization ?? null,
              job_title: sanitized.job_title ?? null,
              website: sanitized.website ?? null,
              birthdate: sanitized.birthdate ?? null,
              address: sanitized.address ?? null,
              notes: sanitized.notes ?? null,
              resourceName: contact?.google_contact_id ?? null,
            }),
          })
        } catch (e: any) {
          console.warn('Google sync failed:', e.message)
        }
      }
    }

    return json({ ok: true })
  } catch (e) { return json({ error: e.message }, 500) }
})
