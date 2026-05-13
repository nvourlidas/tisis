/**
 * google-calendar-import
 *
 * Pulls events from the tenant's "TISIS Tasks" Google Calendar and creates
 * tasks in Supabase for any event not already linked to a task.
 *
 * Body params:
 *   timeMin? — ISO date string, defaults to today (events from this date forward)
 *   calendarId? — override calendar ID (defaults to tenant's stored google_calendar_id)
 *
 * Returns:
 *   { imported: number, skipped: number, tasks: Task[] }
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

async function fetchAllEvents(accessToken: string, calendarId: string, timeMin: string): Promise<any[]> {
  const events: any[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      timeMin,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? 'Failed to fetch calendar events')

    events.push(...(data.items ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return events
}

function extractDate(event: any): string | null {
  const raw = event.start?.dateTime ?? event.start?.date
  if (!raw) return null
  return raw.split('T')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth

    const body = await req.json().catch(() => ({}))
    const timeMin = body.timeMin ?? new Date().toISOString()

    const { data: tokenRow } = await supabase
      .from('tenant_google_tokens')
      .select('refresh_token, google_calendar_id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!tokenRow?.refresh_token) return json({ error: 'Google account not connected' }, 400)

    const calendarId = body.calendarId ?? tokenRow.google_calendar_id
    if (!calendarId) return json({ error: 'No Google Calendar linked to this tenant' }, 400)

    const accessToken = await getAccessToken(tokenRow.refresh_token)
    const events = await fetchAllEvents(accessToken, calendarId, timeMin)

    // Fetch existing google_event_ids so we don't double-import
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('google_event_id')
      .eq('tenant_id', tenantId)
      .not('google_event_id', 'is', null)

    const existingEventIds = new Set((existingTasks ?? []).map((t: any) => t.google_event_id))

    const toImport = events.filter(
      (e) => e.status !== 'cancelled' && e.summary && !existingEventIds.has(e.id),
    )

    if (toImport.length === 0) {
      return json({ imported: 0, skipped: events.length, tasks: [] })
    }

    const rows = toImport.map((e) => ({
      tenant_id: tenantId,
      title: e.summary,
      description: e.description ?? null,
      due_date: extractDate(e),
      status: 'open',
      google_event_id: e.id,
    }))

    const { data: inserted, error } = await supabase
      .from('tasks')
      .insert(rows)
      .select()

    if (error) return json({ error: error.message }, 400)

    return json({
      imported: inserted?.length ?? 0,
      skipped: events.length - toImport.length,
      tasks: inserted,
    })
  } catch (e: any) {
    console.error('google-calendar-import error:', e.message)
    return json({ error: e.message }, 500)
  }
})
