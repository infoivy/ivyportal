# Log: Portal feedback sweep · role homes, money merge, cash flow calendar, CRM reliability

### Prompt
Founder's full-portal voice-memo walkthrough after the team-command-center merge: Performance should be leaders-only with a 7-day default and the per-member week cards back; setters need a setter home (no Team pulse, no morning EOD-status block) while the founder home shows money; the money pages should merge into fewer destinations; "Money calendar" needed a new name and clickable entries (Adem's $2k refund had no way in); Finance ordering and the recurring-revenue chart were wrong; Knowledge should treat the two operating policies as its base; invites glitch and deleted-account re-signups dead-end; the phone field deserved a real country select; the CRM page hung. Plus: bring some real green back.

### Issue
Nine distinct product complaints spanning navigation, per-role information design, money IA, data honesty (MRR decayed to zero as payments got paid), operational dead-ends (orphaned student rows after account deletion, silently consumed invite links), and reliability (unbounded serial Close sweeps with no timeouts auto-running on page load).

### What I did
1. `src/lib/eod-kpi.ts`: one KPI truth source (sets-first rule, legacy leads_contacted fallback, CSM targets) shared by Home and Performance; fixed the dead `["page","dashboard"]` invalidation prefix; revived real green `--success` tokens.
2. Performance: gated to admin/founder/cofounder (redirect for others), 7-day default, restored the founder's per-member week cards (7 KPI-colored chips per person) plus the Today ops strip; migration `founders_view_eods` aligns read access.
3. Money merge: RevenueTabBar = Overview (/finance) · Money in (/revenue with Deals/Plans tabs; installments page moved wholesale into `PaymentPlansSection`) · Payouts. `/installments`, `/sales`, `/sales-hq` are redirect stubs. Deleted cash/setter leaderboards and milestones from deals.
4. Finance: scheduled installment revenue now buckets ALL non-waived payments by due month (paid stays counted), 6-month paged window, collected · still-due split; reconciliation moved to the bottom; bordered month nav.
5. Cash flow calendar (renamed from Money calendar): drill-down rows act — expenses edit/remove via a shared `ExpenseModal` (extracted from Finance), in-flow rows carry the Whop-guarded status control + delete for closer/admin, base pay links to Payouts, commissions marked live; any day takes a one-off cost with the date prefilled (the refund case).
6. Per-role homes: setter reps get My week chips + streak + sets rank + last-7-days totals (`home-setter-week.tsx`) and lose Team pulse; leaders get the payout banner back (restyled calm: hairline danger border, hover, pulse keyframes deleted) plus a money strip (`home-money-strip.tsx`): Whop-net cash last 7 days with logged fallback, and the live to-pay-out total from `fetchPeriodOwed` (extracted in payout-alert.tsx so the payout math stays single-source).
7. Knowledge: Foundations tier on top (EOD & Meetings, CRM Hygiene) replacing the team-ops pinned cards.
8. Signup/team: migration `handle_new_user_student_relink` (20260728201150) auto-relinks unlinked student rows by lower(email) and re-grants the student role; `invite-modal.tsx` shared component with an InvitationsCard (pending/used/expired, copy, regenerate, delete) rendered on Team and invitable from the directory header; phone input gained a real country select (flag + dial code closed, native searchable list open, h-11).
9. CRM: `closeFetch` wraps all 9 Close calls with `AbortSignal.timeout(20s)`; the whole-CRM compliance sweep is manual-only with a session-cached result + ran-at stamp; pipeline card distinguishes connected-but-failing from not-connected; Mochi tiles get a retry banner on query error.

### How I did it
Nine pathspec commits (9d3e87f → e23189c) each gated by `npx tsc --noEmit`, eslint on touched files, `npm run build`, and the contract suite (now 63 tests — added one locking the per-role home shape and the pulse deletion). Migrations applied via Supabase MCP then mirrored locally with the server-assigned version; `npm run supabase:verify` passes (34 tables). Pushed after `git fetch` (no concurrent hermes commits this time); deploy confirmed live by crawling the prod CSS bundle for this batch's markers (`#16A34A` present, `payout-border-breathe` gone) — authenticated route chunks aren't reachable from the signed-out root, so the CSS is the reliable deploy fingerprint.

### What was challenging
- The contract tests ban `getWhopCashWindow` and `from("deals")` inside the home route file, so the founder money strip lives in its own component and the payout-period fetch stayed inside payout-alert.tsx (exported as `fetchPeriodOwed`) to keep the reader-inventory counts stable.
- Setter rank-by-sets on the home only works because `eods_activity_real` is a definer view exposing money-free activity to all staff; the base `eods` table stays own-rows for reps.
- The MRR fix needed the paging offset inside the query key or the chart would never refetch.
- Regenerating an invitation is a plain admin-RLS insert reusing the old row's email/roles/setter type; no server function needed.

### Future work
- Founder decision still parked: revoke setters' pre-existing installments read policy (20260711) vs CLAUDE.md's closer/admin-only rule.
- Trustpilot URL and the Adem Fadil duplicate student rows cleanup remain open.
- Compliance sweep result could persist across sessions (localStorage or a table) if the founder wants history rather than a session cache.
- Consider surfacing signup notifications beyond the Requests tab badge.

## Addendum · full-portal sweep (same day)

Founder asked for a no-questions sweep: data, leftovers, own suggestions, UI polish.

**Data findings and fixes**
- The Adem Fadil plan ($3,000, 3 unpaid rows) was a ghost: his student row's deletion set `installments.student_id` NULL and every money reader inner-joins students, so the plan was invisible and undeletable everywhere. Deleted the ghost (nothing was paid on it), logged his $2,000 refund as a one-off business expense on 2026-07-28 (shows red on Finance and the Cash flow calendar), and hardened the schema: `student_id` NOT NULL + ON DELETE RESTRICT (migration 20260728204646). The plan editor now requires picking a student (the "enter name manually" path created exactly these ghosts) and deleting a student with a plan explains itself.
- Security advisor: six internal trigger/maintenance functions were executable by anon/authenticated via /rest/v1/rpc. Revoked (migration 20260728204825); `npm run supabase:verify` still green (service role unaffected). The two definer views (eods_activity, eods_activity_real) are intentional (internally role-gated); left as designed.
- RLS probe as a real setter: team activity via eods_activity_real 52 rows (chips + rank work), profiles visible, invitations 0, business_expenses 0, other people's base eods 0. Exactly right.
- Data sanity: no paid-without-paid_at, no duplicate student emails, no orphaned payments, no base-pay-without-start-date. Two active setters (Adham Ibrahim, Osama Elsherbeny) have no setter_type and no recent EODs, so no KPI can be inferred; the admin setter-type select on Performance sets it when known.

**Leftovers and dead code**
- Deleted 8 never-imported components (hook-library, mochi-ig-section, onboarding-panel, setter-activity-card, stat-drilldown, team-goal-card, volume-trend-panel, weekly-plan · 1,700 lines) and their contract-test pins.
- Overdue-installment links (home priority + bell rows) now land on /revenue?tab=plans directly instead of the /installments redirect stub.

**UI polish**
- Fixed the invite submit button: black text on near-black primary in light mode.
- Purged the last 18 old dark-navy palette hexes (#2a3140, #232935) for theme tokens across calls, students, action-items, team, profile, invite modal; empty star tints and hover borders now read correctly in light mode.
- sop-canvas legend em dash → " · " (copy rule). Leader home skeleton now mirrors the money strip.

**Left for the founder**
- Enable leaked-password protection in the Supabase Auth dashboard (advisor warning; dashboard toggle only).
- Setter installments-read policy decision still parked; Trustpilot URL still pending.

## Addendum · DM setter KPI raise (founder-directed, same day)

DM setter daily KPI raised from 125 DMs · 3 sets to **300 DMs · 6 sets**, effective 2026-07-29. Implemented as a date-resolved target (`kpiTargetsFor` in `src/lib/eod-kpi.ts`): rows before the effective date keep judging under 125/3, so history does not repaint under a bar that did not exist (same philosophy as the leads_contacted fallback). Killed the EOD page's private copy of the KPI config (it now imports the shared lib) and made the home target card derive from the same source. Copy updated: EOD form bars, invite modal, team admin setter-type labels, EOD policy table (sections.tsx), DM Setting Mastery SOP, CLAUDE.md business rules. Commit 656232b.

## Addendum · founder EOD removal, per-member exemption, profile redesign (2026-07-29)

- Founder-role accounts carry no EOD surfaces: no Your day card, no submit-EOD priority, /eods redirects to Performance.
- New `profiles.eod_exempt` (migration 20260729000000, admin checkbox in the Team member editor) removes any member from expected filers on the home pulse, Performance Team week cards, and the daily digest missed count; exempt members see an optional-submission note on /eods. Contract test re-pinned to enforce the staff-flag rule.
- Profile page rebuilt to the S.O.K. reference: single Personal information card (circular avatar, labeled field grid, email row with inline change, member-since footer) with a Security tab holding password and org management.
