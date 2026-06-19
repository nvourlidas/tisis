import { useEffect, useState } from 'react';
import { Mail, ChevronDown, ChevronRight, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface EmailThread {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  messageCount: number;
}

interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

interface Props {
  clientEmail: string | null | undefined;
}

async function callGmailSync(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stripName(emailFull: string) {
  const match = emailFull.match(/<(.+)>/);
  return match ? match[1] : emailFull;
}

export default function CaseEmails({ clientEmail }: Props) {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [noToken, setNoToken] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, ThreadMessage[]>>({});
  const [loadingThread, setLoadingThread] = useState<string | null>(null);

  useEffect(() => {
    if (clientEmail) load();
  }, [clientEmail]);

  async function load() {
    if (!clientEmail) return;
    setLoading(true);
    try {
      const data = await callGmailSync({ action: 'list-threads', clientEmail });
      if (data.reason === 'no_google_token') { setNoToken(true); return; }
      if (data.reason === 'token_expired' || (data.error && /expired|revoked|invalid_grant/i.test(data.error))) { setTokenExpired(true); return; }
      if (data.ok) setThreads(data.threads ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function toggleThread(threadId: string) {
    if (expandedThread === threadId) {
      setExpandedThread(null);
      return;
    }
    setExpandedThread(threadId);
    if (threadMessages[threadId]) return;
    setLoadingThread(threadId);
    try {
      const data = await callGmailSync({ action: 'get-thread', threadId });
      if (data.ok) setThreadMessages((prev) => ({ ...prev, [threadId]: data.messages }));
    } finally {
      setLoadingThread(null);
    }
  }

  if (!clientEmail) {
    return (
      <div className="text-sm text-text-secondary py-4">
        Ο πελάτης δεν έχει καταχωρημένη διεύθυνση email.
      </div>
    );
  }

  if (noToken) {
    return (
      <div className="text-sm text-text-secondary py-4">
        Δεν έχει συνδεθεί λογαριασμός Google για αυτόν τον οργανισμό.
      </div>
    );
  }

  if (tokenExpired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Σύνδεση Google</h3>
          <p className="text-sm text-text-secondary">
            Η σύνδεση με το Google έχει λήξει. Κάντε κλικ παρακάτω για να ανανεώσετε την πρόσβαση.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setTokenExpired(false)}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Ακύρωση
            </button>
            <button
              onClick={() => {
                supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive',
                    queryParams: { access_type: 'offline', prompt: 'consent' },
                    redirectTo: window.location.href,
                  },
                });
              }}
              className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
            >
              Επανασύνδεση Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Email με: <span className="font-medium text-text-primary">{clientEmail}</span>
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          title="Ανανέωση"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση email…
        </div>
      ) : threads.length === 0 ? (
        <div className="text-sm text-text-secondary py-4">Δεν βρέθηκαν email με αυτή την επαφή.</div>
      ) : (
        <div className="divide-y divide-border/10">
          {threads.map((thread) => (
            <div key={thread.id} className="py-2.5">
              <button
                onClick={() => toggleThread(thread.id)}
                className="w-full flex items-start gap-3 text-left group cursor-pointer"
              >
                <div className="mt-0.5 shrink-0 text-text-secondary group-hover:text-primary transition-colors">
                  {expandedThread === thread.id
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </div>
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">{thread.subject}</p>
                    <span className="text-xs text-text-secondary shrink-0">{formatDate(thread.date)}</span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">
                    {stripName(thread.from)}
                    {thread.messageCount > 1 && (
                      <span className="ml-1.5 bg-border/10 text-text-secondary px-1.5 py-0.5 rounded-full text-[10px]">
                        {thread.messageCount}
                      </span>
                    )}
                  </p>
                  {expandedThread !== thread.id && (
                    <p className="text-xs text-text-secondary mt-0.5 truncate opacity-70">{thread.snippet}</p>
                  )}
                </div>
                <a
                  href={`https://mail.google.com/mail/u/0/#all/${thread.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 text-text-secondary hover:text-primary rounded transition-colors shrink-0 mt-0.5"
                  title="Άνοιγμα στο Gmail"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </button>

              {expandedThread === thread.id && (
                <div className="mt-2 ml-11 space-y-2">
                  {loadingThread === thread.id ? (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Φόρτωση…
                    </div>
                  ) : (
                    (threadMessages[thread.id] ?? []).map((msg) => (
                      <div key={msg.id} className="rounded-lg bg-secondary-background border border-border/10 p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-text-primary truncate">{stripName(msg.from)}</p>
                          <span className="text-[10px] text-text-secondary shrink-0">{formatDate(msg.date)}</span>
                        </div>
                        <p className="text-xs text-text-secondary truncate">Προς: {stripName(msg.to)}</p>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{msg.snippet}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
