/**
 * google-contact-sync
 *
 * Actions:
 *   create — create a new Google Contact and return its resourceName
 *   update — update an existing Google Contact by resourceName
 *   delete — delete a Google Contact by resourceName
 *   pull  — fetch all Google contacts and update matching TISIS contacts by google_resource_name
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}
async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const supabase = adminClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
  const { data: tu } = await supabase.from('tenant_users').select('tenant_id, role').eq('user_id', user.id).single()
  if (!tu) return json({ error: 'No tenant' }, 403)
  return { tenantId: tu.tenant_id, role: tu.role, supabase }
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PEOPLE_BASE = 'https://people.googleapis.com/v1'

async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured')
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description ?? 'Failed to refresh Google token')
  return data.access_token
}

function buildPersonBody(name: string, phone: string | null, phone2: string | null, email: string | null) {
  return {
    names: [{ givenName: name }],
    phoneNumbers: [
      ...(phone ? [{ value: phone, type: 'mobile' }] : []),
      ...(phone2 ? [{ value: phone2, type: 'other' }] : []),
    ],
    emailAddresses: email ? [{ value: email }] : [],
  }
}

async function fetchAllGoogleContacts(accessToken: string): Promise<Map<string, { name: string; phone: string | null; phone2: string | null; email: string | null }>> {
  const result = new Map()
  let pageToken: string | undefined

  do {
    const url = new URL(`${PEOPLE_BASE}/people/me/connections`)
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers')
    url.searchParams.set('pageSize', '1000')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`Google API error: ${res.status}`)
    const data = await res.json()

    for (const p of data.connections ?? []) {
      const name = p.names?.[0]?.displayName?.trim()
      if (!name) continue
      const phones: string[] = (p.phoneNumbers ?? []).map((ph: any) => ph.value?.replace(/\s+/g, '') ?? '')
      const emails: string[] = (p.emailAddresses ?? []).map((em: any) => em.value?.toLowerCase().trim() ?? '')
      result.set(p.resourceName, {
        name,
        phone: phones[0] ?? null,
        phone2: phones[1] ?? null,
        email: emails[0] ?? null,
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth

    const { action, contactId, name, phone, phone2, email, resourceName } = await req.json()

    const { data: tokenRow } = await supabase
      .from('tenant_google_tokens')
      .select('refresh_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!tokenRow) return json({ ok: true, synced: false, reason: 'no_google_token' })

    const accessToken = await getAccessToken(tokenRow.refresh_token)
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    if (action === 'create') {
      const res = await fetch(`${PEOPLE_BASE}/people:createContact`, {
        method: 'POST', headers,
        body: JSON.stringify(buildPersonBody(name, phone, phone2, email)),
      })
      const person = await res.json()
      if (!res.ok) throw new Error(person.error?.message ?? 'Google create failed')
      await supabase.from('contacts').update({ google_resource_name: person.resourceName }).eq('id', contactId).eq('tenant_id', tenantId)
      return json({ ok: true, synced: true, resourceName: person.resourceName })
    }

    if (action === 'update') {
      if (!resourceName) return json({ ok: true, synced: false, reason: 'no_resource_name' })
      const getRes = await fetch(`${PEOPLE_BASE}/${resourceName}?personFields=names,phoneNumbers,emailAddresses`, { headers })
      const current = await getRes.json()
      if (!getRes.ok) throw new Error(current.error?.message ?? 'Google get failed')
      const updateRes = await fetch(
        `${PEOPLE_BASE}/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses`,
        { method: 'PATCH', headers, body: JSON.stringify({ etag: current.etag, ...buildPersonBody(name, phone, phone2, email) }) },
      )
      const updated = await updateRes.json()
      if (!updateRes.ok) throw new Error(updated.error?.message ?? 'Google update failed')
      return json({ ok: true, synced: true })
    }

    if (action === 'delete') {
      if (!resourceName) return json({ ok: true, synced: false, reason: 'no_resource_name' })
      const delRes = await fetch(`${PEOPLE_BASE}/${resourceName}:deleteContact`, { method: 'DELETE', headers })
      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.json()
        throw new Error(err.error?.message ?? 'Google delete failed')
      }
      return json({ ok: true, synced: true })
    }

    if (action === 'pull') {
      // Fetch all Google contacts
      const googleContacts = await fetchAllGoogleContacts(accessToken)

      // Fetch all TISIS contacts that have a google_resource_name
      const { data: tisisContacts, error: fetchErr } = await supabase
        .from('contacts')
        .select('id, name, phone, phone2, email, google_resource_name')
        .eq('tenant_id', tenantId)
        .not('google_resource_name', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      let updated = 0
      for (const contact of tisisContacts ?? []) {
        const googleData = googleContacts.get(contact.google_resource_name)
        if (!googleData) continue

        // Only update if something actually changed
        if (
          googleData.name === contact.name &&
          googleData.phone === contact.phone &&
          googleData.phone2 === contact.phone2 &&
          googleData.email === contact.email
        ) continue

        await supabase
          .from('contacts')
          .update({
            name: googleData.name,
            phone: googleData.phone,
            phone2: googleData.phone2,
            email: googleData.email,
          })
          .eq('id', contact.id)
          .eq('tenant_id', tenantId)

        updated++
      }

      return json({ ok: true, updated })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e: any) {
    console.error('google-contact-sync error:', e.message)
    return json({ error: e.message }, 500)
  }
})
