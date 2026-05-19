import { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, ExternalLink, FileText, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  webViewLink: string;
}

interface Props {
  caseId: string;
  caseCode: string;
  caseTitle: string;
  folderId: string | null;
  folderUrl: string | null;
  onFolderCreated: (folderId: string, folderUrl: string) => void;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function callDriveSync(body: Record<string, unknown>) {
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

export default function CaseFiles({ caseId, caseCode, caseTitle, folderId, folderUrl, onFolderCreated }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [noToken, setNoToken] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderId) return;
    loadFiles();
  }, [folderId]);

  async function loadFiles() {
    if (!folderId) return;
    setLoading(true);
    try {
      const data = await callDriveSync({ action: 'list-files', folderId });
      if (data.reason === 'no_google_token') { setNoToken(true); return; }
      if (data.ok) setFiles(data.files);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !folderId) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const form = new FormData();
      form.append('action', 'upload-file');
      form.append('case_id', caseId);
      form.append('folder_id', folderId);
      form.append('file', file);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      const data = await res.json();
      if (data.ok) setFiles((prev) => [data.file, ...prev]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Διαγραφή αρχείου από το Google Drive;')) return;
    setDeletingId(fileId);
    try {
      await callDriveSync({ action: 'delete-file', fileId });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } finally {
      setDeletingId(null);
    }
  }

  if (noToken) {
    return (
      <div className="text-sm text-text-secondary py-4">
        Δεν έχει συνδεθεί λογαριασμός Google για αυτόν τον οργανισμό.
      </div>
    );
  }

  async function handleCreateFolder() {
    setCreatingFolder(true);
    try {
      const data = await callDriveSync({
        action: 'create-folder',
        caseId,
        folderName: `${caseCode} — ${caseTitle}`,
      });
      if (data.ok && data.folderId) {
        onFolderCreated(data.folderId, data.folderUrl);
      }
    } finally {
      setCreatingFolder(false);
    }
  }

  if (!folderId) {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-sm text-text-secondary">
          Δεν υπάρχει φάκελος Google Drive για αυτή την υπόθεση.
        </p>
        <button
          onClick={handleCreateFolder}
          disabled={creatingFolder}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
          Δημιουργία φακέλου
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {folderUrl && (
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <FolderOpen className="h-4 w-4" />
              Άνοιγμα φακέλου
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFiles}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
            title="Ανανέωση"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Ανέβασμα
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση αρχείων…
        </div>
      ) : files.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">Δεν υπάρχουν αρχεία στον φάκελο.</div>
      ) : (
        <div className="divide-y divide-border/10">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="h-4 w-4 text-text-secondary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{file.name}</p>
                  <p className="text-xs text-text-secondary">{formatBytes(file.size)} · {formatDate(file.modifiedTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-secondary hover:text-primary rounded transition-colors"
                  title="Άνοιγμα"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                  className="p-1.5 text-text-secondary hover:text-red-400 rounded transition-colors disabled:opacity-50 cursor-pointer"
                  title="Διαγραφή"
                >
                  {deletingId === file.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
