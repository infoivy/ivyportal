# Ivy Portal — Agent Guide

Ivy Portal is the internal operating hub for Ivy Sales Academy. It covers team EOD reporting, student success, revenue and installment tracking, internal knowledge, and founder content planning. Preserve the existing visual design unless a task explicitly asks for a redesign.

## Stack and commands

- React 19, TypeScript, Vite 8, TanStack Start/Router, Tailwind 4, Radix UI, and Supabase.
- Production hosting is Vercel; the canonical domain is `https://portal.ivysalesacademy.com`.
- `npm ci` installs locked dependencies; `npm run dev` starts local development; `npm run build` produces the Vercel/Nitro build.
- Copy `.env.example` to `.env` locally. Browser-safe values use `VITE_`; `SUPABASE_SERVICE_ROLE_KEY` is server/maintenance-only and must never be committed or put in frontend code.
- `npm run roles:grant -- email@example.com role` grants a role after the account exists. `npm run supabase:verify` checks the deployed tables, RLS, and policies using the local service role key.
- Migrations live in `supabase/migrations/`. Link with `npx supabase link --project-ref <ref>` and apply with `npx supabase db push`. Never edit an already-applied migration; add a new timestamped migration.

## Project structure

- `src/routes/`: file-based routes. `_authenticated.tsx` is the signed-in route boundary; individual routes add role checks for their feature.
- `src/integrations/supabase/`: client creation, auth middleware, and generated database types.
- `src/lib/auth-context.ts`: session, profile, and role loading. Use `useAuth()` for UI gates, but enforce sensitive access with Supabase RLS as well.
- `src/lib/`: query helpers and domain logic. `revenue.ts`, `streak.ts`, and the route files hold key calculations and workflows.
- `src/components/`: reusable UI and feature components. Keep it presentation-focused.
- `supabase/migrations/`: complete schema history; `docs/DATABASE.md` explains the current database in plain language.
- `scripts/`: maintenance utilities. They are run locally with ignored `.env`, not in the browser.

## Roles and access

The valid business roles are `admin`, `founder`, `closer`, `setter`, `csm`, `coach`, and `student`. A person may have multiple roles. The first account created in a brand-new database automatically receives both `admin` and `founder`; every later account starts without a role until an admin assigns one. `user_roles` plus the security-definer `has_role` function are the backend source of truth.

UI checks use `const { roles } = useAuth()` and `roles.includes('role')`. Do not treat a hidden button or route guard as security. New tables and storage objects must have RLS enabled with policies that enforce the same server-side rule. Gathering Hub, Instagram/content planning, and founder-only docs are founder-only; founder_settings (operational: cash goal, CRM toggle, quarterly goals) remain admin-manageable. Payment details, revenue, and installment records are closer/admin-only unless a narrower existing policy says otherwise. Service credentials are admin-only.

## Business rules — do not weaken these

- EOD reporting is seven days per week: there are no off days. Phone setters target 100 dials and 3 sets daily; DM setters target 125 leads contacted and 3 sets daily; full-cycle setters (both) target 100 dials AND 50 leads outreached AND 3 sets daily.
- Setter commission is base percentage plus +1% for top setter in each 14-day period and +1% when that INDIVIDUAL setter collects $5,000+ cash in a Mon–Sun week (not a team total). There is no PIF bonus for setters.
- Closer commission: 10% close-only. The 15% "set + close" rate applies ONLY when the same person both set and closed the deal (`setter_id === closer_id`) — it replaces 7.5% + 10%. A deal set by a different setter pays that setter their base and the closer 10%; setters never close. (Founder-confirmed 2026-07-10; implemented in `src/lib/revenue.ts` `isSelfSet`.)
- Content cadence is TOF Monday–Thursday and MOF Friday–Sunday. Record in two-week batches; Thursday is recording day.
- Gathering Hub, Content planning, IG analytics, and founder-only docs are FOUNDER-only (admin does not imply access). Payment details are closer/admin-only.
- Historical EOD and revenue records are operational records, not content: do not alter or delete them. Add a new correction/adjustment flow if the business needs an audit trail; never silently rewrite history.
- Do not put Supabase service-role keys, access tokens, OAuth secrets, or customer data in git, browser code, logs, or documentation.

## Change discipline

Keep changes small, typed, and migration-backed. Run `npm run build` and `npx tsc --noEmit` after app changes; run `npm run supabase:verify` after a deployment/migration. Preserve RLS. Use an explicit new migration for schema, policy, function, trigger, or bucket changes. Do not use the service role in client code. Do not change commission rules, role gates, EOD KPIs, or data-history behavior without explicit written approval.
