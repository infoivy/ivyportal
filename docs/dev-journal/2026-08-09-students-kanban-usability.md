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
