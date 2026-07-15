/**
 * gmail-sync
 *
 * Actions:
 *   list-threads — list Gmail threads involving a given email address
 *   get-thread   — get all messages in a thread
 */

import { corsHeaders, json, authenticate } from './auth.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

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

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = await authenticate(req)
    if (auth instanceof Response) return auth
    const { tenantId, supabase } = auth

    const { data: tokenRow } = await supabase
      .from('tenant_google_tokens')
      .select('refresh_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!tokenRow) return json({ ok: true, synced: false, reason: 'no_google_token' })

    let accessToken: string
    try {
      accessToken = await getAccessToken(tokenRow.refresh_token)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('revoked') || msg.toLowerCase().includes('invalid_grant')) {
        return json({ ok: false, reason: 'token_expired', error: msg })
      }
      throw err
    }
    const authHeader = { Authorization: `Bearer ${accessToken}` }

    const { action, clientEmail, emails, threadId } = await req.json()

    if (action === 'list-threads') {
      const emailList: string[] = Array.isArray(emails) && emails.length > 0
        ? emails
        : (clientEmail ? [clientEmail] : [])
      if (emailList.length === 0) return json({ error: 'emails is required' }, 400)

      const uniqueEmails = [...new Set(emailList.map((e) => e.toLowerCase()))].slice(0, 15)
      const q = uniqueEmails.map((e) => `(from:${e} OR to:${e})`).join(' OR ')

      const params = new URLSearchParams({
        q,
        maxResults: '30',
      })
      const listRes = await fetch(`${GMAIL_BASE}/threads?${params}`, { headers: authHeader })
      const listData = await listRes.json()
      if (!listRes.ok) throw new Error(listData.error?.message ?? 'Failed to list threads')

      const threads = listData.threads ?? []
      if (threads.length === 0) return json({ ok: true, threads: [] })

      // Fetch metadata for each thread in parallel (cap at 20)
      const threadDetails = await Promise.all(
        threads.slice(0, 20).map(async (t: { id: string }) => {
          const tRes = await fetch(
            `${GMAIL_BASE}/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            { headers: authHeader },
          )
          const tData = await tRes.json()
          if (!tRes.ok) return null
          const firstMsg = tData.messages?.[0]
          const lastMsg = tData.messages?.[tData.messages.length - 1]
          if (!firstMsg) return null
          const hdrs = firstMsg.payload?.headers ?? []
          return {
            id: tData.id,
            subject: getHeader(hdrs, 'Subject') || '(χωρίς θέμα)',
            from: getHeader(hdrs, 'From'),
            to: getHeader(hdrs, 'To'),
            date: getHeader(lastMsg?.payload?.headers ?? hdrs, 'Date'),
            snippet: tData.snippet ?? '',
            messageCount: tData.messages?.length ?? 1,
          }
        }),
      )

      return json({ ok: true, threads: threadDetails.filter(Boolean) })
    }

    if (action === 'get-thread') {
      if (!threadId) return json({ error: 'threadId is required' }, 400)

      const tRes = await fetch(
        `${GMAIL_BASE}/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: authHeader },
      )
      const tData = await tRes.json()
      if (!tRes.ok) throw new Error(tData.error?.message ?? 'Failed to get thread')

      const messages = (tData.messages ?? []).map((m: any) => {
        const hdrs = m.payload?.headers ?? []
        return {
          id: m.id,
          from: getHeader(hdrs, 'From'),
          to: getHeader(hdrs, 'To'),
          date: getHeader(hdrs, 'Date'),
          snippet: m.snippet ?? '',
        }
      })

      return json({ ok: true, messages })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e: any) {
    console.error('gmail-sync error:', e.message)
    return json({ error: e.message }, 500)
  }
})
