---
projectDir: /Users/x/ivyportal
description: Student portal redesign - three big tabs, today's log first, soft card language
gitBranch: main
status: completed
---

# Log: Student portal complete redesign

### Prompt

"Complete redesign of the student portal... way too overwhelming. Only a few
big buttons. Today's log all the way at the top. Very soft and very
nice-looking, so simple anyone can use it." Structure and log-form collapse
approved via plan mode (3 tabs, notes behind an optional link).

### What I did

- Six tabs became three big buttons: Home / Progress / Board.
- Home: Today's log card first (targets, three big steppers, notes collapsed
  behind "+ Add a note (optional)", h-14 submit, week dots in the footer),
  then this week's call tiles, weekly EOD only when it needs attention
  (collapses to "Weekly EOD is in" once submitted), to-dos, offer-landed ask.
- Progress: weekly numbers, coach/next-call (or group/CSM cards), 1:1
  coaching section, milestones, past logs.
- Board: leaderboard with always-on "you're #N of M" summary, bigger rows.
- New `.card-soft` utility (16px radius) used across student surfaces;
  centered max-w-2xl column; `pressable` big buttons.
- Bottom nav + sidebar now match the portal exactly: Home / Progress /
  Board / Library / Me (they previously disagreed on labels AND icons).
- Legacy tab keys (eod, actions, coaching, milestones, leaderboard) map via
  `normalizeStudentTab` in student-portal-bus.
- Light soft pass: knowledge doc tiles and the profile card.
- Removed from the portal: "Resources for you" block (Library covers it),
  Monday recap card, the separate Actions tab.

### How I did it

Splice-replaced the unlocked return of _authenticated.student-portal.tsx;
ALL handlers, gates (details/Start Here/walkthrough/graduation), draft keys,
and sandbox guards untouched. Deleted dead components (TabButton, MiniStat,
ActionSection, WeeklyRecap), added BigTab. tsc/build/eslint green.

### What was challenging

A naive brace-counting deletion script matched the props object instead of
the function body and left three orphaned component bodies; caught by tsc,
removed by anchor-based splicing.

### Future work

- Visual QA on real accounts (I could only verify compile + build; auth
  blocks headless screenshots). The staff "View their portal" sandbox is the
  fastest way to eyeball every state.
- Locked Start Here + graduation pages kept their old (already simple)
  layout; could adopt card-soft in a follow-up.

---

## Addendum: liquid glass pass + the deploy mystery

- "More liquid glass, complete overhaul": card-soft redefined as translucent
  blurred glass with specular edge; drifting ambient color wash behind all
  student states; tabs merged into one glass pill; floating glass bottom
  nav; translucent inner surfaces; pill submit button.
- Deploy mystery solved: main HAD deployed, but the Arrodes agent
  CLI-deploys its feat/arrodes-portal-ops-endpoint branch to PRODUCTION,
  which took the domain 3 minutes later. Restored with `vercel promote`.
  Open decision for the founder: merge that branch or stop its --prod
  deploys. Recorded in memory (project_ivyportal_deploys).

---

## Addendum 2026-08-13: Mochi re-theme

Founder: study use.themochi.app in the browser and remake the portal in
exactly that style. Logged into the live app, measured real tokens from the
DOM (tray: bg oklch 97% / 0.5px border / r14 / p1; cards white r10 1px
border no shadow; 24px squircle icon chips; active filter chips solid
black; orange #f97316 CTA; dashed-circle empty states; floating white
pill bar). Replaced the liquid-glass skin: card-soft is now the Mochi
white card, new .tray/.chip-icon/.btn-mochi/.empty-mochi utilities,
MochiStat replaces StatCard+Sparkline, TargetBar is a Mochi mini-card
with thin orange/green bar + dot legend, bottom nav is the Ask-Mochi
floating bar with black active pill. Screenshots for comparison saved at
~/mochi-dashboard.png, ~/mochi-performance.png, ~/mochi-inbox.png.
