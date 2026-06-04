/**
 * google-calendar-import
 *
 * Uses Google Calendar incremental sync (syncToken). Events are upserted
 * page-by-page (250 at a time) to keep memory flat regardless of calendar size.
 *
 * Body params:
 *   fullSync? — boolean, forces a full re-sync and clears the stored syncToken
 *   calendarId? — override calendar ID
 *
 * Returns:
 *   { imported: number }
 */

import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

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

class SyncTokenExpiredError extends Error {}

function extractDate(event: any): string | null {
  const raw = event.start?.dateTime ?? event.start?.date
  if (!raw) return null
  return raw.split('T')[0]
}

function extractTime(event: any): string | null {
  const raw = event.start?.dateTime
  if (!raw) return null
  // dateTime is like "2026-06-02T09:30:00+03:00" or "2026-06-02T09:30:00"
  const timePart = raw.split('T')[1]
  if (!timePart) return null
  return timePart.slice(0, 5) // "HH:MM"
}

async function processPage(
  supabase: any,
  tenantId: string,
  items: any[],
): Promise<number> {
  const toUpsert = items.filter((e) => e.status !== 'cancelled' && e.summary)
  const toCancelIds = items.filter((e) => e.status === 'cancelled').map((e) => e.id)

  if (toCancelIds.length > 0) {
    await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('tenant_id', tenantId)
      .in('google_event_id', toCancelIds)
  }

  if (toUpsert.length === 0) return 0

  // Single SQL upsert: inserts new events, updates content fields on existing ones.
  // ON CONFLICT only touches title/description/due_date/due_time — never status.
  const { data, error } = await supabase.rpc('upsert_google_tasks', {
    p_tenant_id: tenantId,
    p_events: toUpsert.map((e) => ({
      google_event_id: e.id,
      title: e.summary,
      description: e.description ?? null,
      due_date: extractDate(e),
      due_time: extractTime(e),
    })),
  })
  if (error) throw new Error(error.message)

  return data ?? 0
}

async function syncCalendar(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
  supabase: any,
  tenantId: string,
): Promise<{ nextSyncToken: string | undefined; totalImported: number }> {
  let pageToken: string | undefined
  let nextSyncToken: string | undefined
  let totalImported = 0

  // For full sync, only go back 5 years — existing rows are already in DB.
  // Subsequent runs use syncToken and only fetch changes (fast).
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const defaultTimeMin = fiveYearsAgo.toISOString()

  const baseParams: Record<string, string> = syncToken
    ? { syncToken }
    : { timeMin: defaultTimeMin, singleEvents: 'true' }

  do {
    // 2500 is Google Calendar API's max page size — 10x fewer round trips than 250
    const params = new URLSearchParams({ ...baseParams, maxResults: '2500' })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await res.json()

    if (res.status === 410) throw new SyncTokenExpiredError()
    if (!res.ok) throw new Error(data.error?.message ?? 'Failed to fetch calendar events')

    // Process and upsert this page immediately — keeps memory flat
    if ((data.items ?? []).length > 0) {
      totalImported += await processPage(supabase, tenantId, data.items)
    }

    pageToken = data.nextPageToken
    if (!pageToken) nextSyncToken = data.nextSyncToken
  } while (pageToken)

  return { nextSyncToken, totalImported }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth

    const body = await req.json().catch(() => ({}))
    const forceFullSync: boolean = body.fullSync === true

    const { data: tokenRow } = await supabase
      .from('tenant_google_tokens')
      .select('refresh_token, google_calendar_id, google_sync_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!tokenRow?.refresh_token) return json({ error: 'Google account not connected' }, 400)

    const calendarId = body.calendarId ?? tokenRow.google_calendar_id
    if (!calendarId) return json({ error: 'No Google Calendar linked to this tenant' }, 400)

    const accessToken = await getAccessToken(tokenRow.refresh_token)
    const storedSyncToken: string | null = forceFullSync ? null : (tokenRow.google_sync_token ?? null)

    let result: { nextSyncToken: string | undefined; totalImported: number }
    try {
      result = await syncCalendar(accessToken, calendarId, storedSyncToken, supabase, tenantId)
    } catch (e) {
      if (e instanceof SyncTokenExpiredError) {
        result = await syncCalendar(accessToken, calendarId, null, supabase, tenantId)
      } else {
        throw e
      }
    }

    if (result.nextSyncToken) {
      await supabase
        .from('tenant_google_tokens')
        .update({ google_sync_token: result.nextSyncToken })
        .eq('tenant_id', tenantId)
    }

    return json({ imported: result.totalImported })
  } catch (e: any) {
    console.error('google-calendar-import error:', e.message)
    return json({ error: e.message }, 500)
  }
})
