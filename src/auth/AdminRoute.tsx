import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, authReady, profile, profileLoading } = useAuth();

  if (!authReady || profileLoading) return <div className="p-6 text-sm text-text-secondary">Φόρτωση…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.tenant_id) return <Navigate to="/no-tenant" replace />;

  const allowed = profile.role === 'owner' || profile.role === 'admin' || profile.role === 'staff' || profile.role === 'member';
  if (!allowed) return <Navigate to="/login?err=unauthorized" replace />;

  return <>{children}</>;
}
