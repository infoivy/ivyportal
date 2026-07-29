# Log: Activity log, simplified student phases, CSM check-in coverage

### Prompt
Founder (2026-07-29, three voice notes): wants every portal action logged with timestamps visible at the bottom of Team admin ("just wanna see who's active or not"); the student phase list felt bloated and "1 on 1 coaching" made no sense for group students ("somebody pays, training videos, looms and roleplays, applying, offer won, khalas, testimonial after"); CSMs need to see who has been checked in on and who is 2+ days cold so they never double up and the whole roster is covered every few days.

### What I did
1. **Activity log**: extended the existing audit_log/write_audit_log trigger pair from 3 tables to 12 (students, action items, 1-on-1 calls, EODs, plans, installment payments, expenses, payout confirmations, check-ins + the original deals/roles/rates), hardened the trigger (skips no-op updates and demo rows), added feed indexes and a team_last_activity view (migration 20260729081046). Team admin renders an Activity log card (plain sentences, newest first, show-older paging) and each member row shows "active X ago", amber after 2 quiet days. Database-level logging means no UI path can forget to log.
2. **Phases**: onboarding → training → applying → offer_won (+ paused). Migration 20260729081443 moved 14 coaching_1on1 rows to training (the enum already had the value), retired uncategorized/testimonial/graduated from every picker, set the column default to onboarding. Readers stay tolerant of legacy values; the graduation journey's last step keys off testimonial_collected; CLAUDE.md updated.
3. **Check-in coverage**: new student_checkins table (who, whom, when; RLS fulfillment-read, log-own-insert, admin-delete; audit-logged; migration 20260729081623). CSM workspace opens with a coverage queue: active coached students coldest-first, red 3d+/never, amber 2d, done-today sinks with the CSM's name, one-tap "Check in", and header math (covered today / roster / full-cycle days from combined csm_daily_target).

### How I did it
Three pathspec commits (bdf5516, then phases, 44eadc1), each gated by tsc, eslint, 63 contract tests, build; migrations MCP-applied then mirrored locally; RLS probe as a setter confirms zero visibility into audit_log and student_checkins; deploys verified via prod asset-hash rotation.

### Future work
- Auto-derive the EOD student_checkins count from the records instead of self-reporting.
- Activity log filters (by member, by table) if the feed gets long.
- supabase:verify still reports 34 tables; its inventory may need the new table registered.
