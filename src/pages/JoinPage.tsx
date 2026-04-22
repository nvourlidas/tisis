import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type InviteInfo = {
  tenant_id: string;
  email: string;
  role: string;
  tenant_name: string;
  expires_at: string;
  used: boolean;
};

type Step = 'loading' | 'invalid' | 'expired' | 'used' | 'form' | 'done';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Ιδιοκτήτης',
  admin: 'Διαχειριστής',
  staff: 'Προσωπικό',
  member: 'Μέλος',
};

export default function JoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStep('invalid'); return; }
    supabase.rpc('get_invite_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.length === 0) { setStep('invalid'); return; }
      const inv = data[0] as InviteInfo;
      if (inv.used) { setStep('used'); return; }
      if (new Date(inv.expires_at) < new Date()) { setStep('expired'); return; }
      setInvite(inv);
      setStep('form');
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName,
            tenant_id: invite.tenant_id,
            role: invite.role,
            invite_token: token,
          },
        },
      });
      if (error) throw error;
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Η εγγραφή απέτυχε.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-xl p-8">
        {step === 'loading' && <p className="text-sm text-text-secondary">Φόρτωση πρόσκλησης…</p>}

        {step === 'invalid' && (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Μη έγκυρη πρόσκληση</h1>
            <p className="text-sm text-text-secondary mb-4">Ο σύνδεσμος πρόσκλησης δεν είναι έγκυρος ή δεν υπάρχει.</p>
            <button onClick={() => navigate('/login')} className="btn-secondary w-full cursor-pointer">Πίσω στη σύνδεση</button>
          </>
        )}

        {step === 'expired' && (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Η πρόσκληση έληξε</h1>
            <p className="text-sm text-text-secondary mb-4">Αυτή η πρόσκληση έχει λήξει. Ζητήστε νέα από τον διαχειριστή σας.</p>
            <button onClick={() => navigate('/login')} className="btn-secondary w-full cursor-pointer">Πίσω στη σύνδεση</button>
          </>
        )}

        {step === 'used' && (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Ήδη χρησιμοποιήθηκε</h1>
            <p className="text-sm text-text-secondary mb-4">Αυτή η πρόσκληση έχει ήδη γίνει αποδεκτή. Δοκιμάστε να συνδεθείτε.</p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full cursor-pointer">Σύνδεση</button>
          </>
        )}

        {step === 'form' && invite && (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-text-primary">Έχετε προσκληθεί</h1>
              <p className="text-sm text-text-secondary mt-1">
                Εγγραφή στο <span className="font-semibold text-text-primary">{invite.tenant_name}</span> ως{' '}
                <span className="font-semibold text-text-primary">{ROLE_LABELS[invite.role] ?? invite.role}</span>
              </p>
              <p className="text-xs text-text-secondary mt-2 bg-white/5 rounded-lg px-3 py-1.5">{invite.email}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div>
                <label className="block text-sm text-text-secondary mb-1">Κωδικός</label>
                <input
                  type="password"
                  className="input w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full cursor-pointer">
                {loading ? 'Δημιουργία λογαριασμού…' : 'Δημιουργία λογαριασμού'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Ο λογαριασμός δημιουργήθηκε!</h1>
            <p className="text-sm text-text-secondary mb-4">
              Ελέγξτε το email σας για να επιβεβαιώσετε τη διεύθυνσή σας και μετά συνδεθείτε.
            </p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full cursor-pointer">Μετάβαση στη σύνδεση</button>
          </>
        )}
      </div>
    </div>
  );
}
