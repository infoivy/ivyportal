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

UI checks use `const { roles } = useAuth()` and `roles.includes('role')`. Do not treat a hidden button or route guard as security. New tables and storage objects must have RLS enabled with policies that enforce the same server-side rule. Founder Hub, Instagram/content planning, and founder settings are founder/admin-only. Payment details, revenue, and installment records are closer/admin-only unless a narrower existing policy says otherwise. Service credentials are admin-only.

## Business rules — do not weaken these

- EOD reporting is seven days per week: there are no off days. Phone setters target 100 dials and 3 sets daily; DM setters target 125 leads contacted and 3 sets daily.
- Setter commission is base percentage plus +1% for top setter in each 14-day period and +1% for a $7,500 week. There is no PIF bonus for setters.
- Content cadence is TOF Monday–Thursday and MOF Friday–Sunday. Record in two-week batches; Thursday is recording day.
- Founder Hub is founder/admin-only. Payment details are closer/admin-only.
- Historical EOD and revenue records are operational records, not content: do not alter or delete them. Add a new correction/adjustment flow if the business needs an audit trail; never silently rewrite history.
- Do not put Supabase service-role keys, access tokens, OAuth secrets, or customer data in git, browser code, logs, or documentation.

## Change discipline

Keep changes small, typed, and migration-backed. Run `npm run build` and `npx tsc --noEmit` after app changes; run `npm run supabase:verify` after a deployment/migration. Preserve RLS. Use an explicit new migration for schema, policy, function, trigger, or bucket changes. Do not use the service role in client code. Do not change commission rules, role gates, EOD KPIs, or data-history behavior without explicit written approval.

## iOS app (ios/ — the Bun app)

The native iOS client lives in `ios/`. It shares the Supabase backend, RLS, and every business rule above; the native layer adds its own rules:

- `ios/project.yml` is the source of truth for the Xcode project. Run `xcodegen generate` inside `ios/` after ANY file add/remove; the committed `.xcodeproj` is regenerated, never hand-edited.
- Supabase credentials come from a gitignored config file (`ios/IvyPortal/Config/`, see its README). Never commit keys; never put the service-role key in the app, tests, fixtures, or logs.
- The launch-argument preset system (see `ios/README.md`) drives DEBUG states: `-demoScenario`, `-demoDestination`, `-workTab`, `-csmTab`, `-moneyTab`, `-homePicture`, `-bunTab`. UI tests and previews must go through presets, not ad-hoc storyboarding.
- `swift test --package-path ios` runs the IvyPortalCore package tests (CI runs this on macOS runners via `.github/workflows/ios-test.yml`, plus an app-hosted simulator test job). Run both before pushing; do not rely on source inspection as build evidence.
- Distribution path: simulator -> real device -> TestFlight via `ios/scripts/testflight.sh` (see `ios/TESTFLIGHT.md`). Never ship without the visual verification gate in `docs/ios/MAC_BUILD_HANDOFF.md`.
- Keep `IvyPortalCore` framework-pure (no SwiftUI imports where logic can stay pure); role/destination policy lives there and is the tested source of truth for navigation visibility.
