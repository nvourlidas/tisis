import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function NoTenantPage() {
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_tenant_for_user', {
        p_tenant_name: firmName.trim(),
      });
      if (error) throw error;
      // Full reload so AuthProvider re-fetches the new tenant_users row
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message ?? 'Κάτι πήγε στραβά.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-secondary-background rounded-2xl border border-border/10 shadow-xl p-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">Δημιουργία χώρου εργασίας</h1>
        <p className="text-sm text-text-secondary mb-6">
          Ο λογαριασμός σας δεν είναι ακόμα συνδεδεμένος με κάποιο γραφείο. Δημιουργήστε τον χώρο εργασίας σας.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Όνομα γραφείου / εταιρείας</label>
            <input
              className="input w-full"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="π.χ. Τantanozis & Partners"
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading || !firmName.trim()} className="btn-primary w-full cursor-pointer">
            {loading ? 'Δημιουργία…' : 'Δημιουργία χώρου εργασίας'}
          </button>
        </form>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
          className="btn-secondary w-full mt-3 cursor-pointer"
        >
          Αποσύνδεση
        </button>
      </div>
    </div>
  );
}
