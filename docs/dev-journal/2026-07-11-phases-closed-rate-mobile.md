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

---

## Addendum: full performance pass (same day)

### What I did
- Router `defaultPreload: "intent"` (all links preload route code on hover/touch); 2px route-transition progress bar; notifications bell converted from `setInterval` to `useQuery` with `refetchInterval`.
- Converted ~20 pages/components from `useState + useEffect + load()` to the useQuery-hydration pattern (`fetchPage` → `useQuery` → one hydration effect → `load = () => q.refetch()`): dashboard (main/cash/goals/IG), calls, revenue, student detail (+milestones), action items, sales (ops + trends), testimonials, admin, team, notes, CSM, founder HQ, weekly review, content planner, Instagram, cash leaderboard, EODs team view. EOD submit form deliberately left uncached (form state must never hydrate stale). Dashboard and sales trends use `placeholderData` to keep numbers visible during range switches.
- Waterfall fixes: coachesQuery, team templates/progress, eods loadMine profile fetch, founder-hq prev-month cash — all folded into their `Promise.all`s.
- Render smoothness: `isAnimationActive={false}` across Recharts series; action items capped at 120 rows/section with "Show all N"; `content-visibility: auto` (`.cv-auto`) on EOD feed + notes cards; `overscroll-contain` on inner scrollers; students at-risk computation memoized into a Map; coaches page indexes calls by coach.
- QoL: ListSkeleton + skeletons replacing bare "Loading…" on 8 surfaces; EOD "Draft saved ✓"; CRM "synced HH:MM" caption. (Add-student disabled-while-saving and deals empty state already existed.)

### Verification
25-route headless crawl: zero blank pages, zero page errors (only pre-existing dev-mode hydration-attribute warnings). Dashboard revisit paints full content in ~290ms, calls revisit ~215ms (cache-hydrated). Mutation smoke: adding an ad-hoc action item through the UI refreshed the list via the refetch path (smoke row cleaned up). Commits `2770fec`, `4a90fda`, `78e0a53`, `74b43bc`, `defc0f2`.

### Future work
- The Vercel env still needs GOOGLE_OAUTH_* + CALENDLY_API_KEY set by the user in the dashboard for calendar/set-reminder features in production.

---

## Addendum 2: pathway/schedules, access defaults, Finance, sets tracker (same day)

- **Log a close parity + tiles**: pathway as two tiles (1:1 = 10 calls / Group Expertise = group only) setting the student's coaching allowance; deposit/split deals get even or custom installment schedules (e.g. $5k = $2k+$2k+$1k) with a matches-remaining validator. RLS bugs found by real-closer E2E: closers couldn't insert/update students or write/read installment plans — fixed in two migrations.
- **Access defaults** (Admin): per-role page visibility + per-role revenue-figure blur; role_access table; AccessGate route guard; BlurMoney wrapper; sidebar filtering. Admin/founder exempt; EOD/Knowledge locked on.
- **Students**: coach filter chips. **Dashboard**: cash hero month-over-month same-day delta line.
- **Finance page** (founder-only): business_expenses table + tracker, day-by-day money flow with running processor balance (manual balance input in founder_settings), profit split 70/15/15, MRR + 6-month chart from installment schedules. Local-date fix (UTC shift zeroed July MRR in GMT+3).
- **Sets tracker**: reminder_log chips (48h/24h/3h/1h, reminded/no-reply), lead confirmation, automatic 6-hour unconfirmed drop (client-triggered cancelSet + gcal delete), bell nudges for open windows, calendar type filter chips (Closing/Coaching/Meetings).
- Guides re-seeded (dark screenshots) after each feature; EOD & Meetings policy page added earlier the same day.
- Commits: 0f89fa4, a157119, 8260210, b4ae520 (+ 74df938, 1f3512f earlier).

---

## Addendum 3: alerts channel, goal pace, trends, setter access, mobile re-pass

- Student Alerts channel (/alerts): persistent team feed, @student tag chips linking to records, day grouping, 20s polling, admin-only delete. student_alerts table + team RLS.
- Gathering Hub goal: pace-vs-goal chart (cumulative cash area vs dashed goal-pace line, today dot, plain-language projection).
- Volume trends unified (dashboard + sales): DMs/Convos/Booked/Shows/Closes, one palette.
- Setters: Sales + Revenue removed from defaults/sidebar/gates (founder decision; CLAUDE.md updated). The "all zeros" report was RLS scoping on a fresh setter account, not the blur.
- Sets: unclaim, assign-to-setter (moves the gcal event), dashboard urgency banner, keep-warm daily cadence with bell nudges, undo/restore for cancelled sets, Calendar|Sets view switcher, coach chips restyled with avatars on Students.
- Admin: audit log moved to the bottom.
- Mobile re-crawl: 22 routes × 3 personas at 390px, zero overflow; set rows now wrap badges under the name.
- Commits: 218afd6, 8dcc204, ce8d43c, 1852ac6 (+ ff68b72 earlier).
