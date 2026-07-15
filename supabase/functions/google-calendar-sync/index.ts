/**
 * google-calendar-sync
 *
 * Actions:
 *   create — create a Google Calendar event for a task, returns google_event_id
 *   update — update an existing event by google_event_id
 *   delete — delete an event by google_event_id
 *
 * Uses the tenant's stored refresh token (admin's Google account).
 * On first use, creates a dedicated "TISIS Tasks" calendar and stores its ID
 * in tenant_google_tokens.google_calendar_id.
 */

import { corsHeaders, json, authenticate } from '../_shared/auth.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_NAME = 'TISIS Tasks'

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

// Returns the dedicated calendar ID, creating it if it doesn't exist yet
async function ensureCalendar(accessToken: string, tenantId: string, supabase: any): Promise<string> {
  const { data: tokenRow } = await supabase
    .from('tenant_google_tokens')
    .select('google_calendar_id')
    .eq('tenant_id', tenantId)
    .single()

  if (tokenRow?.google_calendar_id) return tokenRow.google_calendar_id

  // Create the dedicated calendar
  const res = await fetch(`${CALENDAR_BASE}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: CALENDAR_NAME }),
  })
  const cal = await res.json()
  if (!res.ok) throw new Error(cal.error?.message ?? 'Failed to create Google Calendar')

  await supabase
    .from('tenant_google_tokens')
    .update({ google_calendar_id: cal.id })
    .eq('tenant_id', tenantId)

  return cal.id
}

function buildEventBody(title: string, description: string | null, due_date: string | null, due_time: string | null) {
  const dateStr = due_date
    ? new Date(due_date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  if (due_time) {
    const [hStr, mStr] = due_time.split(':')
    const h = parseInt(hStr, 10)
    const m = mStr ?? '00'
    // End = start + 1 hour, purely in local (Athens) time — no UTC conversion needed
    const endH = (h + 1) % 24
    // If end hour crosses midnight, advance the date
    let endDateStr = dateStr
    if (h + 1 >= 24) {
      const d = new Date(dateStr + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      endDateStr = d.toISOString().slice(0, 10)
    }
    const startDT = `${dateStr}T${String(h).padStart(2, '0')}:${m}:00`
    const endDT = `${endDateStr}T${String(endH).padStart(2, '0')}:${m}:00`
    return {
      summary: title,
      description: description ?? undefined,
      start: { dateTime: startDT, timeZone: 'Europe/Athens' },
      end: { dateTime: endDT, timeZone: 'Europe/Athens' },
    }
  }

  return {
    summary: title,
    description: description ?? undefined,
    start: { date: dateStr },
    end: { date: dateStr },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth

    const { action, taskId, callId, title, description, due_date, due_time, google_event_id } = await req.json()

    const { data: tokenRow } = await supabase
      .from('tenant_google_tokens')
      .select('refresh_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (action === 'check') {
      if (!tokenRow) return json({ connected: false, valid: false })
      try {
        await getAccessToken(tokenRow.refresh_token)
        return json({ connected: true, valid: true })
      } catch (e: any) {
        return json({ connected: true, valid: false, error: e.message })
      }
    }

    if (!tokenRow) return json({ ok: true, synced: false, reason: 'no_google_token' })

    const accessToken = await getAccessToken(tokenRow.refresh_token)
    const calendarId = await ensureCalendar(accessToken, tenantId, supabase)
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

    if (action === 'create') {
      const recordId = taskId ?? callId
      const table = callId ? 'calls' : 'tasks'
      if (!recordId || !title) return json({ error: 'recordId and title are required' }, 400)
      const res = await fetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildEventBody(title, description, due_date, due_time ?? null)),
      })
      const event = await res.json()
      if (!res.ok) throw new Error(event.error?.message ?? 'Failed to create calendar event')

      await supabase
        .from(table)
        .update({ google_event_id: event.id })
        .eq('id', recordId)
        .eq('tenant_id', tenantId)

      return json({ ok: true, synced: true, google_event_id: event.id })
    }

    if (action === 'update') {
      const eventBody = buildEventBody(title, description, due_date, due_time ?? null)

      if (google_event_id) {
        const res = await fetch(
          `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(google_event_id)}`,
          { method: 'PUT', headers, body: JSON.stringify(eventBody) },
        )
        if (res.ok) return json({ ok: true, synced: true })
        if (res.status !== 404) {
          const err = await res.json()
          throw new Error(err.error?.message ?? 'Failed to update calendar event')
        }
        // Event was removed on the Google side — fall through and recreate it below
      }

      // No event yet (task predates calendar sync, or the event was deleted in Google Calendar)
      const recordId = taskId ?? callId
      const table = callId ? 'calls' : 'tasks'
      if (!recordId || !title) return json({ ok: true, synced: false, reason: 'no_event_id' })
      const res = await fetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(eventBody),
      })
      const event = await res.json()
      if (!res.ok) throw new Error(event.error?.message ?? 'Failed to create calendar event')

      await supabase
        .from(table)
        .update({ google_event_id: event.id })
        .eq('id', recordId)
        .eq('tenant_id', tenantId)

      return json({ ok: true, synced: true, google_event_id: event.id })
    }

    if (action === 'delete') {
      if (!google_event_id) return json({ ok: true, synced: false, reason: 'no_event_id' })
      const res = await fetch(
        `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(google_event_id)}`,
        { method: 'DELETE', headers },
      )
      if (!res.ok && res.status !== 404) {
        const err = await res.json()
        throw new Error(err.error?.message ?? 'Failed to delete calendar event')
      }
      return json({ ok: true, synced: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e: any) {
    console.error('google-calendar-sync error:', e.message)
    return json({ error: e.message }, 500)
  }
})
