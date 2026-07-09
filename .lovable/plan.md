
# ISA Team Dashboard — Build Plan

Turn the current ISA canvas into one module inside a bigger team dashboard. This plan is Phase 1 (foundation + EOD + SOPs). Calendar, training videos, analytics, and Close CRM come in later phases so each ships polished, not half-done.

## Phase 1 (this build)

### 1. Auth + roles
- Enable Lovable Cloud (Supabase under the hood).
- Email/password + Google sign-in.
- Roles stored in a separate `user_roles` table (never on profiles) with enum `app_role`: `admin`, `closer`, `setter`. Security-definer `has_role()` function for RLS.
- `profiles` table (display name, avatar, role shown for convenience).
- First user to sign up = admin; admin promotes/demotes others from a Team page.
- Protected app shell under `_authenticated/` (managed layout). Public `/auth` route.

### 2. App shell + navigation
- Left sidebar with sections: Dashboard, EODs, SOPs, Calendar (placeholder), Training (placeholder), Analytics (placeholder), CRM (placeholder), Team (admin only).
- Top bar: user menu, role badge, sign out.
- Keep current dark aesthetic from the ISA canvas.

### 3. EOD submissions + notes
- **EOD form** (setters submit daily): date, DMs sent, convos started, calls booked, calls scheduled, shows, no-shows, wins, blockers, tomorrow's focus, free-text summary.
- **Notes**: quick-note stream per user (thoughts, lead context, objections heard). Filter by author/date/tag.
- **Views**:
  - Setter: my EODs list, submit today's EOD, edit today's before midnight.
  - Admin/closer: team feed of EODs (filter by setter, date range), roll-up totals per day/week.
- Tables: `eods`, `notes`. RLS: users read/write their own; admins + closers read all.

### 4. SOP dashboard
- SOPs are structured documents with sections and cards (same shape as the current ISA canvas).
- Move the existing setting-process canvas in as SOP #1: "ISA Setting Process" — no content changes, just relocate it behind the auth-gated `/sops/isa-setting-process` route.
- SOP index page lists all SOPs with description + owner role.
- Admins can create additional SOPs later via a simple config (data-driven from `src/data/sops/`). No CMS in v1 — SOPs are code-defined, which keeps the beautiful custom layouts.

### 5. Placeholders for future phases
Nav entries exist and route to "Coming in Phase 2" pages so the shape of the app is visible now.

## Phase 2 (next build, after Phase 1 approved)
- **Team calendar**: each closer connects their Google Calendar (per-user OAuth, not the workspace connector — each closer sees their own events). Unified week view showing all closers' booked calls, color-coded by closer.
- **Training videos**: upload to Lovable Cloud storage, organized by category, watch-progress tracking per user.

## Phase 3
- **Analytics**: team + individual dashboards from EOD data (trends, conversion funnels, leaderboard).
- **Close CRM integration**: Close isn't a standard Lovable connector — I'll add it via Close's REST API using a stored API key (admin pastes it in settings). Pull leads, opportunities, activity into the dashboard; write back call outcomes.

## Technical notes

- Stack: TanStack Start (existing), Lovable Cloud, shadcn/ui, Tailwind v4.
- File layout:
  - `src/routes/auth.tsx` — sign in / sign up
  - `src/routes/_authenticated/route.tsx` — managed gate
  - `src/routes/_authenticated/index.tsx` — dashboard home
  - `src/routes/_authenticated/eods.*` — list, new, detail
  - `src/routes/_authenticated/notes.tsx`
  - `src/routes/_authenticated/sops.*` — index + individual SOPs
  - `src/routes/_authenticated/sops/isa-setting-process.tsx` — current canvas moved here
  - `src/routes/_authenticated/team.tsx` — admin-only role management
  - `src/routes/_authenticated/{calendar,training,analytics,crm}.tsx` — Phase 2/3 stubs
- DB migrations: `profiles`, `user_roles` (+ enum + `has_role`), `eods`, `notes`. All with proper GRANTs and RLS.
- Current public `/` (the ISA canvas) becomes a redirect to `/auth` (or `/dashboard` if signed in). The canvas itself lives on inside `_authenticated/sops/isa-setting-process` with zero content changes.

## Out of scope for Phase 1
Calendar OAuth, video uploads/progress, analytics charts, Close CRM API. Nav entries are visible but routes show a "Phase 2" placeholder. This keeps Phase 1 shippable in one pass.

Approve to build Phase 1, or tell me to reshuffle what's in v1 vs later.
