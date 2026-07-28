---
projectDir: /Users/x/Documents/ivy
description: Portal-wide data-consistency sweep, payout confirmations, doc embed, student gating, DM Setting Mastery board
gitBranch: main
status: completed
---

# Log: Consistency sweep · payout confirmations · DM board

### Prompt

Founder: "some numbers are also not showing up and some closes? installments also not showing up in some places. do a sweep of the entire portal and make sure that all the data that is interconnected in different views is showing correctly and always up to date" + "at payouts i want on the payout date for there to be a confirmed button or paid out, and if i dont confirm it i get a reminder every day but like extremely urgent one" + per-member confirmation choice + "the setting framework google doc i just wanted the file to be embedded, not the text to be grabbed" + "why do students see crm hygiene and team eods lol" + DM Setting Mastery Lovable board "put this in there 1:1".

### Issue

Three exploration agents mapped the root causes:
1. RLS silent-empty reads: `deals` SELECT excluded founder/cofounder (Finance computed payouts from empty deals → profit overstated); `profiles` excluded cofounder (id fragments on Payouts); `user_roles` self-only for closer/coach/csm/setter (rosters, dropdowns, coach names collapsed); coach missing csm_tally; closer missing four fulfillment reads; cofounder missing student_alerts.
2. Cache staleness: refetchOnWindowFocus off, no cross-page invalidation anywhere; installments.tsx and payouts.tsx bypassed react-query entirely (mark-paid refreshed NOTHING); csm submitCsmEod refreshed nothing; deal logging never reached leaderboard/dashboard/finance.
3. Students reached staff surfaces: no central route gate; Cmd+K listed /eods and /action-items for everyone; knowledge hardcoded the EOD/CRM policy cards ungated (that is the founder's sighting; zero dual-role accounts exist, verified).

### What I did

- Migration `20260728073714_read_gaps_rls.sql`: nine additive SELECT policies (deals founder/cofounder, profiles cofounder, user_roles all team roles, csm_tally coach, weekly EODs/placements/CSM notes/call attendance for closer, student_alerts cofounder). Verified with per-role JWT probes (setter deals=0 still, student own-only, coach csm_tally now 26).
- `src/lib/query-keys.ts`: key registry + table→dependent-keys map + `invalidateForTables`. refetchOnWindowFocus on. Installments + Payouts converted to react-query. All ~22 mutation sites wired (deals, installments, EODs, CSM writes, student EODs, placements, renames, roster edits, action items, testimonials).
- Student gating: central allowlist redirect in `_authenticated.tsx` (student-only accounts: portal/knowledge/profile), palette role restrictions, knowledge team_ops cards staff-only, guards on /policies/* and /sops/*.
- Payout confirmations: `payout_confirmations` table (period_start+user_id PK, amount snapshot, admin/founder/cofounder RLS); payout math extracted to `src/lib/payout-period.ts`; per-member Mark paid card on Payouts from the payout date; pulsing red banner (Dashboard + Payouts) + pinned red bell row until every member is confirmed (`src/components/payout-alert.tsx`, checks the last two ended periods).
- `docs.embed_url` migration + viewer iframe + admin form field; Setting Framework row now embeds the Google Doc /preview.
- DM Setting Mastery board ported 1:1: `/sops/dm-setting-mastery` + `src/components/sop-canvas.tsx` + cat/route tokens in styles.css; portal theme drives dark; touch drag added; Knowledge card beside ISA Setting Process (admin/setter).
- Regenerated Supabase types; CLAUDE.md gained the invalidation + student-allowlist rules; verify script expects 34 tables.

### How I did it

12 commits (62d95c0..08811fb) pushed to main. Gate green at every step and at the end: tsc clean, 46/46 tests, eslint clean, build clean, supabase:verify 34 tables. Migrations applied via MCP then mirrored locally with the remote-assigned versions.

### What was challenging

- The founder/cofounder deals hole never bit the CURRENT accounts (all hold admin) — the visible "numbers missing" symptoms were mostly the cache class, but Finance's math would silently break the day a pure cofounder logs in.
- "Team EODs for students" was actually the staff /eods page reachable via Cmd+K, not team data (RLS held) and not stale dual roles (query proved zero).
- Payout banner/bell needed the exact ledger math, so the whole row computation moved into a shared lib instead of duplicating it.

### Future work

- Setters can SELECT installments/installment_payments (pre-existing policy from 20260711, powers the dashboard ops chips). CLAUDE.md says payment details are closer/admin-only; founder should decide whether to revoke it.
- Trustpilot page URL for the graduation card still pending.
- Duplicate "Adem Fadil" student rows + unlinked "Sayeed Mohammed" cleanup still parked.
- Consider a search param so the dashboard banner can deep-link Payouts to the exact unconfirmed period (currently it jumps only from the Payouts-page banner).
