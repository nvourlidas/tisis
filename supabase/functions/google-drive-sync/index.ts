/**
 * google-drive-sync
 *
 * Actions:
 *   create-folder — create a Drive folder for a case, stores folder_id back on the case
 *   list-files    — list files in the case's Drive folder
 *   upload-file   — upload a file to the case's Drive folder (multipart/form-data)
 *   delete-file   — delete a file from Drive by fileId
 */

import { corsHeaders, json, authenticate } from './auth.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

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

    const accessToken = await getAccessToken(tokenRow.refresh_token)
    const authHeader = { Authorization: `Bearer ${accessToken}` }

    // upload-file uses multipart/form-data, others use JSON
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData()
      const action = form.get('action') as string
      const caseId = form.get('case_id') as string
      const folderId = form.get('folder_id') as string
      const file = form.get('file') as File

      if (action === 'upload-file') {
        if (!folderId || !file) return json({ error: 'folder_id and file are required' }, 400)

        const metadata = JSON.stringify({ name: file.name, parents: [folderId] })
        const body = new FormData()
        body.append('metadata', new Blob([metadata], { type: 'application/json' }))
        body.append('file', file)

        const res = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`, {
          method: 'POST',
          headers: authHeader,
          body,
        })
        const fileData = await res.json()
        if (!res.ok) throw new Error(fileData.error?.message ?? 'Failed to upload file')
        return json({ ok: true, file: fileData })
      }

      return json({ error: 'Unknown action' }, 400)
    }

    const { action, caseId, folderId, fileId, folderName } = await req.json()

    if (action === 'create-folder') {
      if (!caseId || !folderName) return json({ error: 'caseId and folderName are required' }, 400)

      const res = await fetch(`${DRIVE_BASE}/files?fields=id,webViewLink`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      const folder = await res.json()
      if (!res.ok) throw new Error(folder.error?.message ?? 'Failed to create Drive folder')

      await supabase
        .from('cases')
        .update({ google_drive_folder_id: folder.id, google_drive_url: folder.webViewLink })
        .eq('id', caseId)
        .eq('tenant_id', tenantId)

      return json({ ok: true, folderId: folder.id, folderUrl: folder.webViewLink })
    }

    if (action === 'list-files') {
      if (!folderId) return json({ error: 'folderId is required' }, 400)

      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: '100',
      })
      const res = await fetch(`${DRIVE_BASE}/files?${params}`, { headers: authHeader })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to list files')
      return json({ ok: true, files: data.files ?? [] })
    }

    if (action === 'delete-file') {
      if (!fileId) return json({ error: 'fileId is required' }, 400)
      const res = await fetch(`${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      if (!res.ok && res.status !== 404) {
        const err = await res.json()
        throw new Error(err.error?.message ?? 'Failed to delete file')
      }
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e: any) {
    console.error('google-drive-sync error:', e.message)
    return json({ error: e.message }, 500)
  }
})
