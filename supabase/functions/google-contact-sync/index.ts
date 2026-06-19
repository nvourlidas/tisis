/**
 * google-contact-sync
 *
 * Actions:
 *   create — create a new Google Contact and return its resourceName
 *   update — update an existing Google Contact by resourceName
 *   delete — delete a Google Contact by resourceName
 *   pull  — fetch all Google contacts and update matching TISIS contacts by google_contact_id
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

const AUTO_SEP = '\n\n--- Στοιχεία TISIS ---'
function stripAutoBlock(notes: string | null | undefined): string | null {
  if (!notes) return null
  const stripped = notes.split(AUTO_SEP)[0].trimEnd()
  return stripped || null
}

function buildPersonBody(name: string, phone: string | null, phone2: string | null, email: string | null, organization?: string | null, job_title?: string | null, website?: string | null, birthdate?: string | null, address?: string | null, notes?: string | null) {
  return {
    names: [{ givenName: name }],
    phoneNumbers: [
      ...(phone ? [{ value: phone, type: 'mobile' }] : []),
      ...(phone2 ? [{ value: phone2, type: 'other' }] : []),
    ],
    emailAddresses: email ? [{ value: email }] : [],
    organizations: (organization || job_title) ? [{ name: organization ?? '', title: job_title ?? '' }] : [],
    urls: website ? [{ value: website }] : [],
    birthdays: birthdate ? [formatBirthdayForGoogle(birthdate)] : [],
    addresses: address ? [{ streetAddress: address }] : [],
    biographies: notes ? [{ value: notes, contentType: 'TEXT_PLAIN' }] : [],
  }
}

function parseBirthday(b: any): string | null {
  const d = b?.date
  if (!d?.month || !d?.day) return null
  const year = d.year ? String(d.year).padStart(4, '0') : '1900'
  const month = String(d.month).padStart(2, '0')
  const day = String(d.day).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatBirthdayForGoogle(iso: string | null): any {
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  return { date: { year: year || undefined, month, day } }
}

async function fetchAllGoogleContacts(accessToken: string): Promise<Map<string, { name: string; phone: string | null; phone2: string | null; email: string | null; organization: string | null; job_title: string | null; website: string | null; birthdate: string | null; address: string | null; notes: string | null }>> {
  const result = new Map()
  let pageToken: string | undefined

  do {
    const url = new URL(`${PEOPLE_BASE}/people/me/connections`)
    url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations,urls,birthdays,addresses,biographies')
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
        organization: p.organizations?.[0]?.name?.trim() ?? null,
        job_title: p.organizations?.[0]?.title?.trim() ?? null,
        website: p.urls?.[0]?.value?.trim() ?? null,
        birthdate: parseBirthday(p.birthdays?.[0]),
        address: p.addresses?.[0]?.streetAddress?.trim() ?? null,
        notes: p.biographies?.[0]?.value?.trim() ?? null,
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

    const { action, contactId, name, phone, phone2, email, organization, job_title, website, birthdate, address, notes, resourceName } = await req.json()

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
        body: JSON.stringify(buildPersonBody(name, phone, phone2, email, organization, job_title, website, birthdate, address, notes)),
      })
      const person = await res.json()
      if (!res.ok) throw new Error(person.error?.message ?? 'Google create failed')
      await supabase.from('contacts').update({ google_contact_id: person.resourceName }).eq('id', contactId).eq('tenant_id', tenantId)
      return json({ ok: true, synced: true, resourceName: person.resourceName })
    }

    if (action === 'update') {
      if (!resourceName) return json({ ok: true, synced: false, reason: 'no_resource_name' })
      const getRes = await fetch(`${PEOPLE_BASE}/${resourceName}?personFields=names,phoneNumbers,emailAddresses,biographies`, { headers })
      const current = await getRes.json()
      if (!getRes.ok) throw new Error(current.error?.message ?? 'Google get failed')
      const updateRes = await fetch(
        `${PEOPLE_BASE}/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses,organizations,urls,birthdays,addresses,biographies`,
        { method: 'PATCH', headers, body: JSON.stringify({ etag: current.etag, ...buildPersonBody(name, phone, phone2, email, organization, job_title, website, birthdate, address, notes) }) },
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

    if (action === 'link') {
      // Match unlinked TISIS contacts to Google contacts by phone or email
      const googleContacts = await fetchAllGoogleContacts(accessToken)

      const { data: unlinked, error: fetchErr } = await supabase
        .from('contacts')
        .select('id, phone, phone2, email')
        .eq('tenant_id', tenantId)
        .is('google_contact_id', null)

      if (fetchErr) throw new Error(fetchErr.message)

      // Build lookup maps from Google contacts
      const byPhone = new Map<string, string>()
      const byEmail = new Map<string, string>()
      for (const [resourceName, g] of googleContacts) {
        if (g.phone) byPhone.set(g.phone.replace(/\s+/g, ''), resourceName)
        if (g.phone2) byPhone.set(g.phone2.replace(/\s+/g, ''), resourceName)
        if (g.email) byEmail.set(g.email.toLowerCase(), resourceName)
      }

      let linked = 0
      for (const contact of unlinked ?? []) {
        const p1 = contact.phone?.replace(/\s+/g, '')
        const p2 = contact.phone2?.replace(/\s+/g, '')
        const em = contact.email?.toLowerCase()
        const resourceName =
          (p1 && byPhone.get(p1)) ||
          (p2 && byPhone.get(p2)) ||
          (em && byEmail.get(em)) ||
          null
        if (!resourceName) continue
        await supabase
          .from('contacts')
          .update({ google_contact_id: resourceName })
          .eq('id', contact.id)
          .eq('tenant_id', tenantId)
        linked++
      }

      return json({ ok: true, linked, unlinkedBefore: (unlinked ?? []).length })
    }

    if (action === 'pull') {
      // Fetch all Google contacts
      const googleContacts = await fetchAllGoogleContacts(accessToken)

      // Fetch all TISIS contacts that have a google_contact_id
      const { data: tisisContacts, error: fetchErr } = await supabase
        .from('contacts')
        .select('id, name, phone, phone2, email, organization, job_title, website, birthdate, address, notes, google_contact_id')
        .eq('tenant_id', tenantId)
        .not('google_contact_id', 'is', null)

      if (fetchErr) throw new Error(fetchErr.message)

      let updated = 0
      const debugMisses: string[] = []
      const debugSkipped: Array<{ id: string; name: string; notesTisis: string | null; notesGoogle: string | null }> = []

      for (const contact of tisisContacts ?? []) {
        const googleData = googleContacts.get(contact.google_contact_id)
        if (!googleData) {
          debugMisses.push(contact.google_contact_id)
          continue
        }

        // Strip auto-block from both sides before comparing — we own that block, not Google
        const tisisManualNotes = stripAutoBlock(contact.notes)
        const googleManualNotes = stripAutoBlock(googleData.notes)

        if (
          googleData.name === contact.name &&
          googleData.phone === contact.phone &&
          googleData.phone2 === contact.phone2 &&
          googleData.email === contact.email &&
          googleData.organization === contact.organization &&
          googleData.job_title === contact.job_title &&
          googleData.website === contact.website &&
          googleData.birthdate === contact.birthdate &&
          googleData.address === contact.address &&
          googleManualNotes === tisisManualNotes
        ) {
          debugSkipped.push({ id: contact.id, name: contact.name, notesTisis: tisisManualNotes, notesGoogle: googleManualNotes })
          continue
        }

        // Rebuild notes: Google's manual notes + our existing auto-block (if any)
        const autoBlockSuffix = contact.notes?.includes(AUTO_SEP)
          ? contact.notes.slice(contact.notes.indexOf(AUTO_SEP))
          : ''
        const mergedNotes = googleManualNotes
          ? googleManualNotes + autoBlockSuffix
          : (autoBlockSuffix.trimStart() || null)

        await supabase
          .from('contacts')
          .update({
            name: googleData.name,
            phone: googleData.phone,
            phone2: googleData.phone2,
            email: googleData.email,
            organization: googleData.organization,
            job_title: googleData.job_title,
            website: googleData.website,
            birthdate: googleData.birthdate,
            address: googleData.address,
            notes: mergedNotes,
          })
          .eq('id', contact.id)
          .eq('tenant_id', tenantId)

        updated++
      }

      return json({ ok: true, updated, debug: { googleFetched: googleContacts.size, tisisLinked: (tisisContacts ?? []).length, misses: debugMisses, skipped: debugSkipped.slice(0, 5) } })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e: any) {
    console.error('google-contact-sync error:', e.message)
    return json({ error: e.message }, 500)
  }
})
