import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthCtx, type Profile, type Session } from './AuthContext';

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  async function loadProfile(s: Session | null) {
    if (!s) { setProfile(null); return; }
    setProfileLoading(true);
    try {
      const { data: tenantUserRow, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, role')
        .eq('user_id', s.user.id)
        .maybeSingle();
      if (error) { console.warn('profile load error', error); setProfile(null); return; }
      const email = s.user.email ?? null;
      const fullName = (s.user.user_metadata?.full_name as string | undefined) ?? null;
      const newProfile = {
        id: s.user.id,
        tenant_id: tenantUserRow?.tenant_id ?? null,
        role: (tenantUserRow?.role as 'owner' | 'admin' | 'staff' | 'member') ?? null,
        email,
        full_name: fullName,
        display_name: fullName ?? email?.split('@')[0] ?? 'Account',
      };
      setProfile(newProfile as unknown as Profile);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const sess = data.session ?? null;
        setSession(sess);
        loadProfile(sess);
      } catch (e) {
        console.warn('Auth init error', e);
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ session, profile, authReady, profileLoading }),
    [session, profile, authReady, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
