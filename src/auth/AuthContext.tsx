import { createContext } from 'react';
import { supabase } from '../lib/supabase';

export type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

export type Profile =
  | {
      id: string;
      tenant_id: string | null;
      role: 'owner' | 'admin' | 'staff' | 'member' | null;
      email: string | null;
      full_name: string | null;
      display_name: string;
    }
  | null;

export type AuthCtx = {
  session: Session | null;
  profile: Profile;
  authReady: boolean;
  profileLoading: boolean;
};

export const AuthContext = createContext<AuthCtx | undefined>(undefined);
