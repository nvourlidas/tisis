import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';

const GOOGLE_SCOPES = 'openid email profile https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.readonly';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/>
    </svg>
  );
}

export default function GoogleAuthAlert() {
  const { profile } = useAuth();
  const [expired, setExpired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    let cancelled = false;
    supabase.functions.invoke('google-calendar-sync', { body: { action: 'check' } }).then(({ data, error }) => {
      if (cancelled || error) return;
      if (data?.connected && !data.valid) setExpired(true);
    });
    return () => { cancelled = true; };
  }, [profile?.tenant_id]);

  const handleReconnect = async () => {
    setReconnecting(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  };

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-secondary-background rounded-2xl border border-border/10 shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Η σύνδεση με το Google έληξε</h2>
        <p className="text-sm text-text-secondary">
          Ο συγχρονισμός με το Google Calendar έχει σταματήσει να λειτουργεί επειδή η σύνδεση με το Google έληξε ή ανακλήθηκε.
          Συνδεθείτε ξανά για να συνεχίσει ο συγχρονισμός εργασιών και κλήσεων.
        </p>
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          <GoogleIcon />
          {reconnecting ? 'Ανακατεύθυνση…' : 'Σύνδεση ξανά με Google'}
        </button>
      </div>
    </div>
  );
}
