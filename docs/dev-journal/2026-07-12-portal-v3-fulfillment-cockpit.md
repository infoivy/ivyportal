---
projectDir: /Users/x/Documents/ivy
description: Portal v3 — fulfillment cockpit, sales handover, cleanups (full plan executed)
gitBranch: main
status: completed
---

# Log: Portal v3 — Fulfillment Cockpit + Sales Handover + Cleanups

### Prompt
Founder is handing daily ops to co-founders — Abu Bilal (sales) and Faizan (fulfillment) — and asked for: dashboard/CRM/payouts cleanups, Mochi tab replicating Mochi's own dashboard, Whop-first revenue, Student Alerts folded into Team Chat, semi-monthly payouts with monthly base pay (CSM $500), and a deep remake of the fulfillment side ("heart of the mentorship", 95% placement target) with placements up top.

### Issue
Fulfillment was duty-logging, not a lifecycle cockpit: no placement pipeline (binary `offer_landed_at` only), no computed health score, no merged activity timeline, no proactive alerts, and CSM accountability was counters rather than "who needs me today". Sales/payout surfaces weren't gated for the cofounder handover.

### What I did
- **A — cleanups**: team-goal copy fixes; Q3 Goals + Team Composition removed; EOD stepper as joined input group; CRM tabs Close (closers+admin) | Mochi (admin/founder/cofounder); Revenue headline from Whop; Student Alerts → Team Chat student tagging (migration `20260712140000`).
- **B — payouts**: semi-monthly periods (1st–15th / 16th–end), inclusive boundaries; `profiles.base_pay_monthly` (migration `20260712150000`) editable in Team, rendered as a Base pay section.
- **C — Mochi replica**: `getMochiHome` server fn; revenue KPI row, Default Funnel, Upcoming Payments + Recent Collections in `mochi-crm.tsx`.
- **D1 — placements**: `student_placements` table + RLS + placed-trigger (migration `20260712160000`); `PlacementsSection` first block on student detail + portal tab; `PlacementBoard` kanban in CSM Workspace.
- **D2 — health score**: `src/lib/student-health.ts` (deterministic 100-pt score: EOD 35, items 15, 1-on-1 15, volume 15, placement 20; payment −20, ghosting cap 25) + `use-student-health.ts` shared hook; shown in students list, detail hero, CSM overview strip.
- **D3+D6 — CSM Today queue**: red→amber→green ranked, last-touch tiebreak, inline check-in/action-item/open; coverage header; overview health + funnel rows.
- **D4 — timeline**: placement events joined the existing merged feed (calls, EODs, notes, payments, win/offer markers) via shared query cache.
- **D5 — bell alerts**: computed fulfillment alerts (no EOD 3d+, payment behind, no 1-on-1 14d+ in coaching, interviews within 48h) for admin/csm/coach/cofounder.
- **E — ownership**: payouts gate + nav admit cofounder; CLAUDE.md dept split + payout-period rules; migration `20260712170000_fulfillment_read_access` (see below).

### How I did it
Per-part commits on `main` ("feat: v3 …", final `6832383`). Migrations applied live via Supabase MCP then mirrored to `supabase/migrations/`; types regenerated. Verified against a local prod build (`PORT=3999 node --env-file=.env .output/server/index.mjs`) with Playwright: 17 page loads across six scratch role accounts (founder, cofounder, csm, closer, setter, student) plus an 11-check RLS matrix — all passing, fixtures deleted after. `npm run supabase:verify`: 32 tables, RLS on, policies present.

### What was challenging
- RLS gaps surfaced only through the role matrix: **csm had no select on `student_eods`/`student_calls`**, so health scores silently computed from zero data; founder/cofounder couldn't read `students` at all (masked by the real founder also holding admin). Fixed with additive select-only policies.
- CSM overview rendered the phase legend twice (BreakdownBar has a built-in legend).
- Playwright screenshots need generous waits; two "failures" were just loading skeletons.
- The repeated `TypeError: Failed to fetch` console error on localhost is the Vercel analytics beacon, not an app bug.

### Future work
- `npm run demo:remove` before real rollout (demo data still seeded: 50 students, 48 deals).
- Assign real roles: Abu Bilal `cofounder + closer`, Faizan `cofounder + csm`.
- Parked: recurring roleplay/work-session calendar events (needs days/times); `adam@isa.demo` auth deletion (Supabase 500).
- Phase 2 (out of scope): LLM coaching suggestions, ATS integrations, cohort benchmarking, employer feedback loop.

## Status

- [x] Part A — quick fixes
- [x] Part B — payouts semi-monthly + base pay
- [x] Part C — Mochi tab replica
- [x] Part D1 — placement pipeline
- [x] Part D2 — health score
- [x] Part D3+D6 — CSM Today queue + overview
- [x] Part D4 — activity timeline
- [x] Part D5 — bell alerts
- [x] Part E — dept ownership + polish/verification

## Outcome

Completed. Deviations:
- D4 reduced to extending an already-existing TimelineFeed rather than building one.
- Part E added an unplanned RLS migration (`fulfillment_read_access`) after the role matrix exposed missing csm/founder/cofounder reads.
- Inkdrop MCP unreachable — this fallback file replaces the plan/journal notes.
