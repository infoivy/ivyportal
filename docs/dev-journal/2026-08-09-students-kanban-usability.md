---
projectDir: /Users/x/ivyportal
description: Kanban cards fully clickable, pathway (1:1 vs group) view, Start Here badges name the exact step
gitBranch: main
status: completed
---

# Log: Students kanban usability round

### Prompt

Three asks in one session: (1) "in the kanban view make all students clickable
as well, i have to go into list view to see their profile", (2) "i should also
be able to have a view for students in group coaching and in 1:1 pathway",
(3) "in the 0/5 and 3/5 etc. instead of just number tell me the exact step
they are on or havent done".

### Issue

Kanban cards only linked the tiny name text; there was no way to slice the
roster by program type; Start Here progress showed a bare count with no hint
of WHICH step a locked student is stuck on.

### What I did

- Whole kanban card now opens the student profile (click anywhere except the
  quick-edit controls); drag-to-move still works.
- Pathway toggle (All / 1:1 / Group) on the Students page, applies to table,
  kanban, and graduation views. Group = calls_allotted 0.
- Start Here surfaces now name the exact current step: table lock badge and
  kanban cards show "n/5 · on: <step>" (tooltip has the full step title), and
  the bell's "Stuck in Start Here" alert includes it too.

### How I did it

- `students.tsx`: card `onClick` with `closest("a, button, select, input,
  textarea, label")` guard + `useNavigate`; `pathwayFilter` state wired into
  the `filtered` memo; `guideStepsQ` now returns done step keys per student
  (was a count), `startHereNext()` derives the first missing step.
- `student-guide-steps.ts`: added `shortLabel` per step and
  `nextStartHereStep()` (steps are sequential, so "the step they are on" is
  the first not done).
- `notifications-bell.tsx`: stuck alert appends "· on: <step>".

### What was challenging

Click vs drag on the same card: HTML5 drag suppresses the click event after a
real drag, so a plain onClick with an interactive-element guard is enough.

### Future work

- Setters can't read student_guide_steps under RLS, so for them locked badges
  read 0/5 "on: Onboarding form" regardless of truth. If setters need real
  Start Here visibility, widen the select policy.

---

## Round 2 (same day): profile journey card, health in plain words, sandbox gate

### Prompt

"View their portal shows Student Portal asking for the number, I don't
understand" · "on the profile I want to see exactly what steps they're at and
completed" · "what is Watch 0 / At risk" · "make the profile less messy,
softer, better overview".

### What I did

- StartHereJourneyCard on the student profile (locked students): all five
  steps with done dates, current step highlighted, progress bar, Unlock
  button moved into it.
- Health chip explained inline: "At risk · health 19/100 · why:" + reason
  chips under the contact row (was tooltip-only).
- Sandbox: banner over the timezone/WhatsApp gate explaining that IS the
  student's current screen, plus a local-only "Skip ahead" button.
- Chips are pill-shaped and grouped under Journey / Setup labels.

### Note

The confusing sandbox screen was CORRECT behavior: the student genuinely
still sits at the details gate. The fix was context, not code behavior.

---

## Round 3: header redesign shipped + the data layer

### Prompt

"Redesign this page, sizing is weird, feels messy" + "Wednesday had the most
EODs, what happened? Let me click days. Give me who has access, at what time,
what timeframe, touch points. I want a lot of data."

### What I did

- Profile header redesign (plan-approved): identity + uniform action cluster,
  ONE health banner with reasons, Journey/Setup aligned rows, calm loom gate.
- Student output chart: click-a-bar drilldown (per-student numbers, submit
  times, avg comparison, missing filers). Lands in CSM hub + Student success.
- Revenue trend chart: same drilldown for deals (closer/setter/set+close/
  value/cash/logged-at).
- NEW portal_activity presence tracking: migration applied to prod via
  Supabase MCP (local CLI had no credentials; file made idempotent so a
  future `supabase db push` is harmless). portal_ping(_day) RPC called from
  _authenticated.tsx on sign-in / refocus / every 10 min while visible.
- StudentActivityCard on the profile: 30-day touchpoint stream across nine
  tables + presence, counts, last seen + usual hour in student timezone,
  intensity dot strip with portal-open rings.

### Note

Presence data starts accumulating from deploy time (2026-08-09) — no
backfill exists, the UI says "tracked since Aug 2026".
