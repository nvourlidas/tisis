import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
        <p className="text-sm text-text-secondary text-center mt-4">
          {mode === 'login' ? 'Δεν έχετε λογαριασμό;' : 'Έχετε ήδη λογαριασμό;'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="text-primary hover:underline cursor-pointer"
          >
            {mode === 'login' ? 'Δημιουργήστε έναν' : 'Συνδεθείτε'}
          </button>
        </p>
      </div>
    </div>
  );
}
