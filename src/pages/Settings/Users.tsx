import { useEffect, useState } from 'react';
import { Copy, Check, Plus, X, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth';
import { supabase } from '../../lib/supabase';

type Member = {
  user_id: string;
  role: string;
  email: string;
  display_name: string;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  used: boolean;
  expires_at: string;
  created_at: string;
};

const ROLES = ['admin', 'staff', 'member'] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Ιδιοκτήτης',
  admin: 'Διαχειριστής',
  staff: 'Προσωπικό',
  member: 'Μέλος',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-primary/15 text-primary',
  admin: 'bg-blue-500/15 text-blue-400',
  staff: 'bg-green-500/15 text-green-400',
  member: 'bg-border/20 text-text-secondary',
};

export default function UsersSettings() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id ?? '';
  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<typeof ROLES[number]>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    const [{ data: m }, { data: i }] = await Promise.all([
      supabase.from('tenant_members').select('*').eq('tenant_id', tenantId).order('created_at'),
      supabase.from('invites').select('*').eq('tenant_id', tenantId).eq('used', false).order('created_at', { ascending: false }),
    ]);
    setMembers((m as Member[]) ?? []);
    setInvites((i as Invite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setInviteError(null);
    setInviting(true);
    try {
      const { error } = await supabase.from('invites').insert({
        tenant_id: tenantId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        created_by: profile?.id,
      });
      if (error) throw error;
      setInviteEmail('');
      setInviteRole('staff');
      setShowInviteForm(false);
      await load();
    } catch (err: any) {
      setInviteError(err?.message ?? 'Αποτυχία δημιουργίας πρόσκλησης.');
    } finally {
      setInviting(false);
    }
  };

  const deleteInvite = async (id: string) => {
    await supabase.from('invites').delete().eq('id', id);
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const isExpired = (expires_at: string) => new Date(expires_at) < new Date();

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Ομάδα</h1>
        <p className="text-sm text-text-secondary mt-0.5">Διαχείριση χρηστών που έχουν πρόσβαση στο σύστημα.</p>
      </div>

      {/* Μέλη */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Μέλη</h2>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="btn-primary inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Πρόσκληση
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary">Φόρτωση…</p>
        ) : (
          <div className="rounded-xl border border-border/10 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/10">
                {members.map((m) => (
                  <tr key={m.user_id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{m.display_name}</div>
                      <div className="text-xs text-text-secondary">{m.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Φόρμα πρόσκλησης */}
      {showInviteForm && (
        <section className="rounded-xl border border-border/10 bg-secondary-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Νέα πρόσκληση</h2>
            <button onClick={() => setShowInviteForm(false)} className="text-text-secondary hover:text-text-primary cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={createInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Email</label>
              <input
                type="email"
                className="input w-full"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
                placeholder="συνάδελφος@example.com"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs text-text-secondary mb-1">Ρόλος</label>
              <select
                className="input w-full"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof ROLES[number])}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={inviting} className="btn-primary inline-flex items-center gap-1.5 cursor-pointer shrink-0">
              <Plus className="h-4 w-4" />
              {inviting ? 'Αποστολή…' : 'Δημιουργία'}
            </button>
          </form>
          {inviteError && <p className="text-sm text-danger">{inviteError}</p>}
        </section>
      )}

      {/* Εκκρεμείς προσκλήσεις */}
      {invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Εκκρεμείς προσκλήσεις</h2>
          <div className="rounded-xl border border-border/10 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/10">
                {invites.map((inv) => (
                  <tr key={inv.id} className={isExpired(inv.expires_at) ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="text-text-primary">{inv.email}</div>
                      <div className="text-xs text-text-secondary">
                        {ROLE_LABELS[inv.role] ?? inv.role} · {isExpired(inv.expires_at) ? 'Έληξε' : `Λήγει ${new Date(inv.expires_at).toLocaleDateString('el-GR')}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isExpired(inv.expires_at) && (
                          <button
                            onClick={() => copyLink(inv.token)}
                            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            {copiedToken === inv.token
                              ? <><Check className="h-3.5 w-3.5 text-green-400" />Αντιγράφηκε!</>
                              : <><Copy className="h-3.5 w-3.5" />Αντιγραφή συνδέσμου</>}
                          </button>
                        )}
                        <button
                          onClick={() => deleteInvite(inv.id)}
                          className="text-text-secondary hover:text-danger transition-colors cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
