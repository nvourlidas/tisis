import { supabase } from './supabase';

export async function callDriveSync(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function uploadFileToDrive(file: File, folderId: string, caseId: string, accessToken: string) {
  const form = new FormData();
  form.append('action', 'upload-file');
  form.append('case_id', caseId);
  form.append('folder_id', folderId);
  form.append('file', new File([file], file.name, { type: file.type }));
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return res.json();
}

export async function findOrCreateSubfolder(parentFolderId: string, folderName: string) {
  return callDriveSync({ action: 'find-or-create-subfolder', folderId: parentFolderId, folderName });
}
