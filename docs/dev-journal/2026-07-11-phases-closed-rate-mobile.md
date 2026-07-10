# Log: Student journey phases, Closed Rate, founder lockdown, seed v2, mobile pass

### Prompt
Several user requests in one session: make the demo seed "extremely realistic" over 3 months; admins should not access founder stuff; rename the final funnel card from Show Rate to Closed Rate; rework student phases (onboarding → 1:1 coaching → applying → offer won → testimonial) and stop flagging post-coaching students as at-risk; make the CSM selected-student highlight more professional; optimize mobile view for every page and button.

### Issue
- Phases (`training`, `graduated`) didn't match the real student journey, and at-risk logic flagged students who had simply finished their 1:1 call block (dashboard showed 43–47 at-risk out of 47).
- The sales Trends scorecard had two show-rate cards (Booked→Shows and Show Rate) and no close metric.
- Admin could still see Gathering Hub/Content/IG/founder docs.
- Seed data had too-sparse coaching calls and no student EODs, making at-risk numbers absurd.
- Several dense grids (action items, 1:1 calls, team, calendar) collapsed badly at phone widths.

### What I did
- Migrations `20260711040000/40001`: added enum values `applying`, `offer_won`, `testimonial`; remapped `training→onboarding`, `graduated→offer_won`. Regenerated Supabase types.
- Scoped at-risk to `onboarding|coaching_1on1|applying` everywhere (dashboard, students list, student success); the 14-day-call rule now only applies during `coaching_1on1`.
- Updated phase labels/colors across students, student detail, student success, student portal; student portal "training targets" now keyed to onboarding phase.
- Sales Trends: last card is Closed Rate = closes/shows (with compare delta); added `closes` to the trends query/totals.
- Founder-only lockdown (RLS + nav + palette + routes) committed with seed v2; CLAUDE.md updated.
- Seed v2: weekly 1:1 calls continue to today while in coaching (252 calls), 1,093 student EOD rows, phases per the new journey, 6 testimonials. Dashboard at-risk now 3.
- CSM workspace: selected student = muted fill + slim amber inset rail (no layout shift); fixed hardcoded `#2a3140` chip borders.
- Mobile pass at 390px: action items and 1:1 calls collapse to stacked cards with meta lines; team role chips wrap under the member; calendar shows a 3-day window anchored on today with wrapping toolbar; TabsList scrolls when overflowing. Verified via headless Chrome crawl (25 routes, overflow detection + screenshots).

### How I did it
Python bulk-edit scripts over route files; MCP `apply_migration` + local migration files; deterministic seed re-runs; Playwright(channel: chrome) crawls at 390×844 with per-element overflow detection; `npx tsc --noEmit` + `npm run build` gates. Commits `35b07a6`, `198a187`, `0e5cebe` pushed to main.

### What was challenging
- Postgres can't drop enum values, so legacy `training`/`graduated` stay in the type; UI keeps a fallback in `phaseMeta` so stale rows can't crash rendering.
- `ALTER TYPE ... ADD VALUE` can't be used in the same transaction — needed two migrations.
- Seed cleanup deletes any `@isa.demo` account outside the cast, which kept killing the QA login mid-verification; switched to `qa-admin@demo.local` (deleted after verification).

### Future work
- Remaining approved perf plan: router preload/progress bar (#28), useQuery cache conversions (#29–31), smoothness (#32), QoL skeletons (#33), verification (#34).
- Consider a UI affordance to collect testimonial when moving a student to the `testimonial` phase (currently just a phase + `testimonial_collected` flag).
- Google OAuth client secret was pasted in chat earlier — user should regenerate it.
