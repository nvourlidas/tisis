import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const {
      name, phone, phone2, email, notes, vat, address,
      job_title, organization, website,
      father_name, mother_name, birthdate, amka, iban, at, taxis_username, taxis_password,
    } = await req.json()
    if (!name?.trim()) return json({ error: 'Name is required' }, 400)

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        phone: phone || null,
        phone2: phone2 || null,
        email: email || null,
        notes: notes || null,
        vat: vat || null,
        address: address || null,
        job_title: job_title || null,
        organization: organization || null,
        website: website || null,
        father_name: father_name || null,
        mother_name: mother_name || null,
        birthdate: birthdate || null,
        amka: amka || null,
        iban: iban || null,
        at: at || null,
        taxis_username: taxis_username || null,
        taxis_password: taxis_password || null,
        is_client: false,
      })
      .select()
      .single()
    if (error) return json({ error: error.message }, 400)

    // Await Google sync so it completes before the function exits
    try {
      const authHeader = req.headers.get('Authorization')!
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-contact-sync`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          contactId: data.id,
          name: data.name,
          phone: data.phone,
          phone2: data.phone2,
          email: data.email,
          organization: data.organization,
          job_title: data.job_title,
          website: data.website,
          birthdate: data.birthdate,
          address: data.address,
          notes: data.notes,
        }),
      })
    } catch (e: any) {
      console.warn('Google sync failed:', e.message)
    }

    return json(data)
  } catch (e: any) { return json({ error: e.message }, 500) }
})
