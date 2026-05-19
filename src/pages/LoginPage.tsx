import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'openid email profile https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/', { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setDone(true);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Κάτι πήγε στραβά.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-xl p-8 text-center">
          <h1 className="text-xl font-bold text-text-primary mb-2">Ελέγξτε το email σας</h1>
          <p className="text-sm text-text-secondary">
            Στείλαμε σύνδεσμο επιβεβαίωσης στο <span className="font-medium text-text-primary">{email}</span>.
            Κάντε κλικ για να ενεργοποιήσετε τον λογαριασμό σας και μετά συνδεθείτε.
          </p>
          <button onClick={() => { setDone(false); setMode('login'); }} className="btn-secondary w-full mt-6 cursor-pointer">
            Πίσω στη σύνδεση
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-xl p-8">
        <h1 className="text-xl font-bold text-text-primary mb-6">
          {mode === 'login' ? 'Σύνδεση' : 'Δημιουργία λογαριασμού'}
        </h1>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-border/30 bg-secondary-background hover:bg-border/10 transition-colors text-sm font-medium text-text-primary cursor-pointer disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? 'Ανακατεύθυνση…' : 'Συνέχεια με Google'}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border/20" />
          <span className="text-xs text-text-secondary">ή</span>
          <div className="flex-1 h-px bg-border/20" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-text-secondary mb-1">Ονοματεπώνυμο</label>
              <input
                className="input w-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Email</label>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Κωδικός</label>
            <input
              type="password"
              className="input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full cursor-pointer">
            {loading
              ? (mode === 'login' ? 'Σύνδεση…' : 'Δημιουργία…')
              : (mode === 'login' ? 'Σύνδεση' : 'Δημιουργία λογαριασμού')}
          </button>
        </form>
        {/* <p className="text-sm text-text-secondary text-center mt-4">
          {mode === 'login' ? 'Δεν έχετε λογαριασμό;' : 'Έχετε ήδη λογαριασμό;'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="text-primary hover:underline cursor-pointer"
          >
            {mode === 'login' ? 'Δημιουργήστε έναν' : 'Συνδεθείτε'}
          </button>
        </p> */}
      </div>
    </div>
  );
}
