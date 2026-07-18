# Log: Onboarding-gated student portal, two-mode EODs, weekly call checklist

### Prompt
Founder feedback on hermes' recent student-portal work: weekly EOD should sit UNDER the daily EOD and only shout at end of week; replace the 0–7 attendance count with ticking off actual call names (from Skool, names only — times differ per timezone); full salam in Arabic; rebuild Start Here as a hard gate (new students see ONLY Start Here until the five onboarding steps are done, then the portal unlocks, phase auto-updates, CSMs/admins get notified, 1:1 students get an automatic "Book your 1:1 coaching calls" task); weekly EOD also asks 1:1 students how many 1:1s they had (they're limited to 10 and some sit on them); daily student EOD loses Summary and Replies, keeps Interviews, roleplays always 3/day; two post-onboarding modes — loom-review students send 3 looms/day to THE INNER CIRCLE LOOM REVIEW CHAT (not to offers) until CSMs approve them, then 5 loom applications/day — never both loom fields at once.

### Issue
Hermes had shipped the weekly EOD above the daily one, stat-tile-heavy, with a bare 0–7 count; Start Here was a passive checklist mixing onboarding with ongoing activities (including a "Book your 1:1" step and an auto-locked "apply" step); the daily EOD showed five counters including both loom fields at once plus Summary/Replies clutter; nothing gated brand-new students away from placements/EODs/action items they can't use yet; nobody was notified when a student finished onboarding; lazy 1:1 booking was invisible.

### What I did
- Migration `20260718170545_student_onboarding_flow`: `student_weekly_eods.calls_attended jsonb` ({day,name} array; `group_calls_attended` mirrors count for existing staff readers) + `one_on_one_calls smallint`; `org_settings.group_call_schedule jsonb` seeded Mon–Sun from the Skool calendar screenshot; `students.onboarding_completed_at` (NULL = portal locked to Start Here), backfilled `= created_at` so nobody active got locked out.
- Migration `20260718171737_students_csm_update`: students UPDATE policy extended to CSMs (they approve looms and unlock portals).
- `src/lib/student-guide-steps.ts`: the five canonical Start Here steps (typeform → offer_board → offer_board_loom → skool_training → offer_board_course), shared by UI and server.
- `src/lib/student-onboarding.functions.ts`: `completeStudentOnboarding` server fn — re-verifies all steps server-side via admin client, stamps completion, advances phase (only from uncategorized/onboarding → coaching_1on1), idempotently inserts the "Book your 1:1 coaching calls — you have N" action item for 1:1 students, posts 🎓 to team_chat.
- `student-portal.tsx`: locked early-return (salam + Start Here only); full salam `السلام عليكم ورحمة الله وبركاته` in both variants; unlock flow on last tick (confetti, toast, cache invalidation); daily EOD → 3 counters (Roleplays / stage-dependent loom field / Interviews), Inner-Circle-chat copy pre-approval, Summary+Replies inputs removed (columns kept; old values pass through untouched on edit); KPI cards and recaps swap Replies→Roleplays; weekly card moved below the daily form, slimmed (no tiles/chips), per-call checkboxes, 1:1 counter with "X/10 used" and a nudge when 0, teaser "opens Sunday" for first-week students, due/overdue banner at tab top that scrolls to it.
- `student-bottom-nav.tsx`: mobile nav collapses to Start+Me while locked (own query, no dependency on hermes' concurrently-edited `_authenticated.tsx`).
- `notifications-bell.tsx`: computed "Completed Start Here onboarding" alert for fulfillment, 3-day window, backfill-safe (`completed_at != created_at`), ranked top.
- `students.$id.tsx`: `canManage` now includes CSM; Program chip (1:1 ⇄ Group via `calls_allotted`); "Approve looms → applying (5/day)" and "Unlock portal now" actions; staff weekly view shows attended call names + self-reported 1:1s.
- `admin.tsx`: Portal settings card to edit the seven Mon–Sun call names (org_settings).
- Types (surgical, generator-shape-matched): new columns + previously-missing `student_guide_steps` table; rewrote `student-weekly-eod.ts` lib + tests for the checkbox shape.

### How I did it
Pulled hermes' latest first and audited its weekly-EOD migration/lib/tests before touching anything. Key simplification: program type and loom-approval already derive from `calls_allotted > 0` and `phase ∈ {applying,…}` — the two EOD modes needed no new columns, just an explicit CSM action that sets `phase = 'applying'`. Applied both migrations via Supabase MCP, then renamed the local files to the remote-assigned versions (20260718170545, 20260718171737) to keep `db push` in sync. Verified DB-level flows under real JWTs with `SET LOCAL request.jwt.claims` in rolled-back transactions: student reads 7-entry schedule, student weekly-EOD insert with new columns, CSM phase-flip + unlock. Hermes was committing concurrently (its WIP became `975e27c` mid-session), so I committed only my 12 files via pathspec, then built+tested the exact deploy commit in a clean `git worktree` (npm ci, 45/45 tests, tsc, build) before pushing `8406a56`. Updated CLAUDE.md (student-flow business rule, CSM update rights) and docs/DATABASE.md.

### What was challenging
- Working alongside a live agent: hermes committed its auth WIP between my audit and my commit; pathspec commits and the clean-worktree build kept our work separate and the deploy state verified.
- The Skool screenshot truncates most call names ("Script …", "Setting …", "Role F…") — seeded best-effort guesses (Off Call Drills, Role Finding, Roleplays, Script Review, Setting Masterclass, Call Review, Roleplays) and made them admin-editable in Admin → Portal settings; founder must correct them there.
- Backfill edge cases: existing students must not lock (backfilled `created_at`), backfilled rows must not fire "completed onboarding" alerts (`completed_at != created_at` guard), and a mid-week unlock must not show "Overdue" for a week that predates the student (first-week teaser).
- CSMs lacked students UPDATE under RLS even though the founder's flow has CSMs approving looms — extended the policy (explicitly flagged in the summary since it's a role-gate change).

### Addendum (same day)
Founder reversed the backfill: ALL existing students now go through the gate too ("all the existing students as well should have this lock on basis of their program type"). Cleared `onboarding_completed_at` for all 19 students (all are 1:1 pathway; zero daily EODs existed, so nothing was lost). Legacy checklist ticks partially carry over (typeform/offer_board/skool_training); legacy `book_1on1`/`group_calls` keys are ignored; nobody was left with a fully-ticked-but-locked checklist. Follow-up commit `530d59f`: the bell no longer fires missed-EOD or missed-1:1 alerts for locked students — they can't submit EODs and the 1:1 push starts at unlock.

### Future work
- Founder should verify/correct the seven call names in Admin → Portal settings (screenshot names were truncated).
- The offer-board walkthrough Loom step has no URL in the portal — the Loom lives in the offer board itself; could add a configurable link.
- Weekly 1:1 self-reports could be reconciled against staff-logged `student_calls` to flag discrepancies.
- Consider a WhatsApp/email nudge for the Sunday weekly EOD (currently in-portal banner only).
