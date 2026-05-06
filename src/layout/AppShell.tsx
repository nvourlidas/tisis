import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { NAV, type NavEntry } from '../_nav';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, ChevronDown, Sun, Moon, Crown, Zap } from 'lucide-react';
import { useTheme, type ThemeMode } from '../lib/useTheme';

type Tenant = { name: string };

type PlanTier = 'free' | 'starter' | 'pro';

function normalizeTier(raw: unknown): PlanTier {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('pro')) return 'pro';
  if (s.includes('starter')) return 'starter';
  return 'free';
}

function tierRank(t: PlanTier) { return t === 'free' ? 0 : t === 'starter' ? 1 : 2; }
function needsUpgrade(userTier: PlanTier, minPlan?: 'starter' | 'pro') {
  if (!minPlan) return false;
  return tierRank(userTier) < tierRank(minPlan);
}
function planBadgeLabel(minPlan?: 'starter' | 'pro') {
  if (!minPlan) return null;
  return minPlan.toUpperCase();
}

export default function AppShell() {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    (async () => {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from('tenants').select('name').eq('id', profile.tenant_id).maybeSingle();
      setTenant(data ?? null);
    })();
  }, [profile?.tenant_id]);


  return (
    <div className="min-h-screen bg-background text-text-primary flex">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:bg-secondary-background lg:border-r lg:border-border/10 lg:sticky lg:top-0 lg:h-screen lg:shrink-0">
        <SidebarNav theme={theme} onToggleTheme={toggleTheme} />
      </aside>

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-secondary-background border-r border-border/10 flex flex-col transform transition-transform duration-200 ease-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarNav theme={theme} onToggleTheme={toggleTheme} />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Header */}
        <header className="h-14 sticky top-0 z-20 bg-secondary-background border-b border-border/10">
          <div className="h-full px-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/10 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-text-primary">TISIS</span>
              {tenant?.name && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-border/40 text-sm">•</span>
                  <span className="text-sm font-medium text-text-secondary truncate max-w-40">{tenant.name}</span>
                </div>
              )}
            </div>
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ theme, onToggleTheme }: { theme: ThemeMode; onToggleTheme: () => void }) {
  const { profile } = useAuth();
  const sidebarDisplayName = profile?.display_name ?? 'Dashboard';
  const role = profile?.role ?? 'member';
  const location = useLocation();

  const userTier = useMemo(() => normalizeTier('free'), []);

  const visible = useMemo(
    () => NAV.filter((e) => {
      if (e.type === 'item') return !e.roles || e.roles.includes(role);
      if (e.type === 'group') return !e.roles || e.roles.includes(role);
      return true;
    }),
    [role],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 py-4 shrink-0 border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Crown className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">Σύστημα</div>
            <div className="text-xs font-semibold text-text-primary truncate">{sidebarDisplayName.split(' ')[0]}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-3 space-y-0.5">
        {visible.map((e, i) => {
          if (e.type === 'section') {
            return (
              <div key={`sec-${i}`} className="px-2 pt-4 pb-1.5 text-[10px] tracking-widest font-bold uppercase text-text-secondary/50">
                {e.title}
              </div>
            );
          }
          if (e.type === 'divider') {
            return <div key={`div-${i}`} className="my-2 border-t border-border/10" />;
          }
          if (e.type === 'item') {
            const badge = needsUpgrade(userTier, (e as any).minPlan) ? planBadgeLabel((e as any).minPlan) : null;
            return (
              <NavItem key={`item-${e.to}-${i}`} to={e.to} label={e.label} end={e.end}
                Icon={e.icon as LucideIcon | undefined} badge={badge} />
            );
          }
          return (
            <SidebarGroup key={`group-${e.label}-${i}`} entry={e} currentPath={location.pathname}
              role={role} userTier={userTier} />
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border/10 px-3 py-3 space-y-1">
        {/* Theme toggle */}
        <div className="flex gap-1.5 px-1">
          <button
            onClick={() => theme !== 'light' && onToggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              theme === 'light'
                ? 'border border-border/30 bg-secondary-background text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            Light
          </button>
          <button
            onClick={() => theme !== 'dark' && onToggleTheme()}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border border-border/30 bg-secondary-background text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            Dark
          </button>
        </div>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary uppercase shrink-0">
            {(profile?.display_name?.[0] ?? '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary truncate">{sidebarDisplayName}</div>
            <div className="text-[10px] text-text-secondary truncate">{profile?.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarGroup({
  entry, currentPath, role, userTier,
}: {
  entry: Extract<NavEntry, { type: 'group' }>;
  currentPath: string;
  role: string;
  userTier: PlanTier;
}) {
  const initiallyOpen = entry.children.some((ch) => currentPath.startsWith(ch.to));
  const [open, setOpen] = useState(initiallyOpen);
  const children = entry.children.filter((ch) => !ch.roles || ch.roles.includes(role));
  const GroupIcon = entry.icon as LucideIcon | undefined;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-all duration-150 cursor-pointer',
          open ? 'bg-primary/10 text-primary font-semibold' : 'text-text-secondary hover:bg-border/5 hover:text-text-primary',
        ].join(' ')}
      >
        <span className="flex items-center gap-2.5">
          {GroupIcon ? <GroupIcon className="h-4 w-4 shrink-0" /> : null}
          <span>{entry.label}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-[max-height] duration-200 ease-out ${open ? 'max-h-96' : 'max-h-0'}`}>
        <div className="pl-3 mt-0.5 space-y-0.5 border-l border-border/10 ml-5">
          {children.map((ch, idx) => {
            const badge = needsUpgrade(userTier, (ch as any).minPlan) ? planBadgeLabel((ch as any).minPlan) : null;
            return <NavItem key={`${ch.to}-${idx}`} to={ch.to} label={ch.label} end={ch.end}
              Icon={ch.icon as LucideIcon | undefined} nested badge={badge} />;
          })}
        </div>
      </div>
    </div>
  );
}

function NavItem({ to, label, end, Icon, nested = false, badge = null }: {
  to: string; label: string; end?: boolean;
  Icon?: LucideIcon; nested?: boolean; badge?: string | null;
}) {
  void nested;
  return (
    <NavLink
      to={to} end={end}
      className={({ isActive }) =>
        ['flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150',
          isActive ? 'bg-primary/12 text-primary font-semibold' : 'text-text-secondary hover:bg-border/5 hover:text-text-primary',
        ].join(' ')
      }
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span className="flex-1 min-w-0 leading-snug whitespace-normal">{label}</span>
      {badge && (
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/8 text-accent px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
          {badge === 'PRO' ? <Crown className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function UserMenu() {
  const { profile } = useAuth();
  const displayName = profile?.display_name ?? 'Account';
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email?.[0] ?? '?').toUpperCase();

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-lg border border-border/10 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
      >
        <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-[9px] font-bold text-primary uppercase">
          {initials}
        </div>
        <span className="text-xs font-medium text-text-primary hidden sm:block max-w-25 truncate">
          {displayName.split(' ')[0]}
        </span>
        <ChevronDown className={`h-3 w-3 text-text-secondary transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/10 bg-secondary-background shadow-xl overflow-hidden z-50"
          style={{ animation: 'menuIn 0.15s ease' }}>
          <div className="px-4 py-3 border-b border-border/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary uppercase shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{displayName}</div>
                <div className="text-[11px] text-text-secondary truncate">{profile?.email}</div>
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              {profile?.role}
            </div>
          </div>
          <div className="p-1.5">
            <button onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger/8 transition-all cursor-pointer">
              <LogOut className="h-4 w-4" />
              Αποσύνδεση
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
