import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth
    const body = await req.json()
    const {
      name, phone, phone2, phone3, phone4, email, email2, email3, email4,
      vat, address, job_title, organization, website, notes,
      father_name, mother_name, birthdate, amka, iban, at, taxis_username, taxis_password,
      contact_id: existingContactId,
    } = body

    if (!name?.trim()) return json({ error: 'Name is required' }, 400)

    let contactId: string

    if (existingContactId) {
      // Link to existing contact and mark it as a client
      const { error: contactErr } = await supabase
        .from('contacts')
        .update({ is_client: true })
        .eq('id', existingContactId)
        .eq('tenant_id', tenantId)
      if (contactErr) return json({ error: contactErr.message }, 400)
      contactId = existingContactId
    } else {
      // Create a new contact record mirroring the client data
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          phone: phone || null,
          phone2: phone2 || null,
          phone3: phone3 || null,
          phone4: phone4 || null,
          email: email || null,
          email2: email2 || null,
          email3: email3 || null,
          email4: email4 || null,
          vat: vat || null,
          address: address || null,
          job_title: job_title || null,
          organization: organization || null,
          website: website || null,
          notes: notes || null,
          father_name: father_name || null,
          mother_name: mother_name || null,
          birthdate: birthdate || null,
          amka: amka || null,
          iban: iban || null,
          at: at || null,
          taxis_username: taxis_username || null,
          taxis_password: taxis_password || null,
          is_client: true,
        })
        .select()
        .single()
      if (contactErr) return json({ error: contactErr.message }, 400)
      contactId = contact.id
    }

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        name: name.trim(),
        phone: phone || null,
        phone2: phone2 || null,
        phone3: phone3 || null,
        phone4: phone4 || null,
        email: email || null,
        email2: email2 || null,
        email3: email3 || null,
        email4: email4 || null,
        vat: vat || null,
        address: address || null,
        job_title: job_title || null,
        organization: organization || null,
        website: website || null,
        notes: notes || null,
        father_name: father_name || null,
        mother_name: mother_name || null,
        birthdate: birthdate || null,
        amka: amka || null,
        iban: iban || null,
        at: at || null,
        taxis_username: taxis_username || null,
        taxis_password: taxis_password || null,
      })
      .select()
      .single()
    if (clientErr) return json({ error: clientErr.message }, 400)
    return json(client)
  } catch (e) { return json({ error: e.message }, 500) }
})
