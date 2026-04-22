# TISIS Law Firm CRM

A case-centric CRM for TISIS G.Tantanozis & Partners Law Firm.

## Core Philosophy
**The case is the center of everything.** Every piece of data — clients, contacts, calls, tasks, financials — connects to a case. Nothing gets lost; unlinked items are flagged until connected.

## Tech Stack
- React 19 + TypeScript + Tailwind CSS 4
- Supabase (Postgres + Auth) — project ref: `xhyuwnebgkbxvrzijfwn`
- React Router 7, Vite, Lucide React icons
- MCP: Supabase MCP configured in `.claude/settings.local.json`

## Running the App
```bash
npm run dev      # dev server
npm run build    # production build (runs TS check first)
npm run lint     # ESLint
```

## Architecture

### Multi-Tenant Auth
- All DB tables have `tenant_id` (references `tenants.id`)
- `tenant_users` maps auth users → tenant with a role: `owner | admin | staff | member`
- Auth flow: `AuthProvider` → loads `tenant_users` → sets `profile` with `tenant_id` + `role`
- Route protection: `AdminRoute` (owner/admin only) wraps `AppShell`
- Hook: `useAuth()` → `{ session, profile, authReady, profileLoading }`

### File/Feature Pattern
Each feature lives in `src/pages/[Feature]/` and follows this structure:
```
Feature/
├── types.ts          # TypeScript types
├── featureUtils.ts   # Supabase queries (always filter by tenant_id)
├── Feature.tsx       # List page
├── FeatureDetail.tsx # Detail/single record page (where applicable)
└── modals/
    └── NewFeatureModal.tsx
```
Always import supabase client from `../../lib/supabase` and tenant_id from `useAuth()`.

### Navigation
Defined in `src/_nav.ts`. Add new routes to `src/main.tsx` under the `AppShell` children.

---

## Database Schema

### Auth / Tenant Layer
| Table | Key Columns |
|-------|-------------|
| `tenants` | id, name, created_at |
| `tenant_users` | user_id (FK auth.users), tenant_id (FK tenants), role, created_at |

### CRM Tables
| Table | Key Columns |
|-------|-------------|
| `clients` | id, tenant_id, name, phone, phone2, email, vat, address, professional_status, notes |
| `cases` | id, tenant_id, client_id, code, title, status (active/pending/closed), stage, description, next_critical_date, google_drive_url, notes |
| `contacts` | id, tenant_id, name, phone, email, role, notes |
| `case_contacts` | case_id, contact_id (junction table) |
| `calls` | id, tenant_id, phone, caller_name, direction (incoming/outgoing), case_id, client_id, contact_id, description, follow_up_required |
| `tasks` | id, tenant_id, case_id, contact_id, source_call_id, title, description, due_date, status (open/done), completed_at |
| `financials` | id, tenant_id, case_id, type (fee/expense/receipt), amount, description, date |

> RLS is enabled on all tables. Policies (role-based) to be added later.

---

## Build Plan — Status

### ✅ Completed
- [x] Phase 1: Database schema (all tables created in Supabase)
- [x] Auth cleanup: removed `profiles` and `tenant_subscription_status` tables + updated `AuthProvider`/`AuthContext`

### 🔲 Remaining Phases (in order)

**Phase 2 — Clients**
- `src/pages/Clients/types.ts`
- `src/pages/Clients/clientUtils.ts` — fetchClients, fetchClient, createClient, updateClient, searchClients
- `src/pages/Clients/Clients.tsx` — list with search
- `src/pages/Clients/ClientDetail.tsx` — client card + their cases + financial summary
- `src/pages/Clients/modals/NewClientModal.tsx`
- Routes: `/clients`, `/clients/:id`

**Phase 3 — Cases (most important)**
- `src/pages/Cases/types.ts`
- `src/pages/Cases/caseUtils.ts`
- `src/pages/Cases/Cases.tsx` — list with status filter (active/pending/closed)
- `src/pages/Cases/CaseDetail.tsx` — tabbed: Info | Contacts | Calls | Tasks | Financials
- `src/pages/Cases/modals/NewCaseModal.tsx`
- Routes: `/cases`, `/cases/:id`

**Phase 4 — Contacts**
- `src/pages/Contacts/` — similar to Clients but simpler
- Auto-suggest existing contact by phone when creating a call
- Routes: `/contacts`, `/contacts/:id`

**Phase 5 — Calls (speed-first UX)**
- `src/pages/Calls/modals/NewCallModal.tsx` ← most critical UX piece
  - Phone → auto-lookup existing contact
  - Quick mode: phone + name + description (3 clicks)
  - Full mode: add case, contact, follow-up flag
  - "Create task from this call" checkbox
  - Unlinked calls (no case) saved and flagged on dashboard
- `src/pages/Calls/Calls.tsx` — list, flag unlinked ones in orange
- Routes: `/calls`

**Phase 6 — Tasks**
- `src/pages/Tasks/Tasks.tsx` — all tasks, grouped: today / overdue / upcoming / done
- Tasks NEVER disappear until marked done — overdue stays red and visible
- Routes: `/tasks`

**Phase 7 — Dashboard**
- Replace stub `src/pages/Dashboard.tsx` with real widgets:
  - "New Call" prominent button (most-used action)
  - Today's Tasks
  - Overdue Tasks (red)
  - Unlinked Calls (orange, with "Link to case" action)
  - Upcoming Critical Dates (next 7 days)

**Phase 8 — Nav & Cleanup**
- Update `src/_nav.ts`: replace Items with Cases, Clients, Contacts, Calls, Tasks
- Update `src/main.tsx`: add all new routes, remove Items route
- Delete `src/pages/Items/`

**Phase 9 — RLS Policies (deferred)**
- Add row-level security policies per role for all CRM tables
- owner/admin: full CRUD
- staff: full CRUD on CRM tables, read-only financials
- member: read-only on cases/clients, can create calls/tasks

---

## Key Design Rules
1. **Tasks never disappear** — overdue tasks stay visible until marked done
2. **Calls can be unlinked** — saved without a case, flagged for later linking
3. **Speed over completeness** — quick entry first, enrich later
4. **Google Drive** — cases link to a Drive folder URL (open button, not embed)
5. **No Google Calendar yet** — future phase
