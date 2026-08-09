---
projectDir: /Users/x/ivyportal
description: Sandbox "view as student" mode - staff open any student's exact portal view from Students, interact freely, nothing persists
gitBranch: main
status: completed
---

# Plan: Student portal sandbox view

## Prompt

"For each student, if I go to Customers > Students and click on e.g. Adam, I want a
'View his portal' place where every setter and every person can see exactly what that
student sees. Add it to the workspace as 'Sandbox view' / 'Student view' - they should
be able to fill in details, complete the steps, and understand the student view in its
entirety."

## Approach

Render the REAL `StudentPortal` component (route `/student-portal`) in a sandbox
context keyed to a target student id. Reads use existing staff RLS (staff can read
students + student_eods etc.). Every write path is intercepted: the UI simulates the
outcome locally (ticks, confetti, unlock, EOD submit) and nothing touches the DB -
no notifications, no phase changes, no records.

## Steps

- [ ] `src/lib/student-sandbox.ts`: `StudentSandboxContext` + `useStudentSandbox()`
- [ ] `_authenticated.student-portal.tsx`: export component; sandbox-aware `load()`
      (fetch student by id instead of user_id); guard/simulate all writes
      (daily EOD, weekly EOD, attendance ticks, guide steps + unlock, action items,
      details gate, offer landed, walkthrough, graduation review); disable
      localStorage drafts and auth-keyed server-fn queries in sandbox
- [ ] `student-portal.functions.ts`: allow staff roles to fetch the leaderboard
      (staff already read all student EODs via RLS; no new exposure), optional
      `viewAsStudentId` so "You" highlights the sandbox student
- [ ] New route `_authenticated.students_.$id.portal.tsx`: staff-side sandbox page
      with a banner (student name, "sandbox - nothing is saved", Exit, Reset)
- [ ] `students.$id.tsx`: "View their portal" button in the header
- [ ] `npm run build` + `npx tsc --noEmit`, commit, push

## Status

- [x] Sandbox context lib (`src/lib/student-sandbox.ts`)
- [x] Student portal sandbox guards (daily/weekly EOD, attendance, guide steps
      + simulated unlock, action items, details gate, offer landed, walkthrough,
      graduation review, drafts off, caller-keyed server-fn queries off)
- [x] Leaderboard staff access (`leaderboardAccess` + optional `viewAsStudentId`)
- [x] Sandbox route + banner (`/students/$id/portal`, Reset + Exit)
- [x] Entry button on student detail header ("View their portal")
- [x] Build green (`npm run build`), `tsc --noEmit` clean, eslint clean

## Outcome

Completed. Notes:

- Inkdrop MCP was unreachable this session; journal written to docs/dev-journal per fallback rule.
- Reads use existing staff RLS: roles that can't read a table (e.g. setters on
  student_guide_steps) simply see that section empty; no policies were widened.
- The leaderboard server fn now ALSO answers staff callers; students' access
  path is unchanged. Staff could already read all student EODs under RLS, so
  nothing new is exposed.
- Follow-up candidates: surface the button in the Students list rows; let the
  sandbox also cover /knowledge and /profile as-the-student.
