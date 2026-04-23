import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Settings,
  Users,
  Briefcase,
  BookUser,
  Phone,
  CheckSquare,
} from 'lucide-react';

export type PlanTier = 'free' | 'starter' | 'pro';

type NavItem = {
  type: 'item';
  label: string;
  to: string;
  end?: boolean;
  roles?: string[];
  icon?: LucideIcon;
  minPlan?: Exclude<PlanTier, 'free'>;
};

type NavGroupChild = {
  label: string;
  to: string;
  end?: boolean;
  roles?: string[];
  icon?: LucideIcon;
  minPlan?: Exclude<PlanTier, 'free'>;
};

type NavGroup = {
  type: 'group';
  label: string;
  roles?: string[];
  icon?: LucideIcon;
  minPlan?: Exclude<PlanTier, 'free'>;
  children: NavGroupChild[];
};

export type NavEntry =
  | { type: 'section'; title: string }
  | { type: 'divider' }
  | NavItem
  | NavGroup;

export const NAV: NavEntry[] = [
  { type: 'section', title: 'Main' },
  { type: 'item', label: 'Πίνακας Ελέγχου', to: '/', end: true, icon: LayoutDashboard },
  { type: 'item', label: 'Υποθέσεις', to: '/cases', icon: Briefcase },
  { type: 'item', label: 'Εντολείς', to: '/clients', icon: Users },
  { type: 'item', label: 'Επαφές', to: '/contacts', icon: BookUser },
  { type: 'item', label: 'Κλήσεις', to: '/calls', icon: Phone },
  { type: 'item', label: 'Εργασίες', to: '/tasks', icon: CheckSquare },

  { type: 'section', title: 'Ρυθμίσεις' },
  {
    type: 'group',
    label: 'Ρυθμίσεις',
    icon: Settings,
    roles: ['owner', 'admin'],
    children: [
      { label: 'Ομάδα', to: '/settings/users', roles: ['owner', 'admin'] },
    ],
  },
];
