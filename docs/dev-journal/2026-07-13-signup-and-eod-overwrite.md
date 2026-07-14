# Log: Signup failures + EOD day-overwrite

### Prompt
Signup on the portal doesn't work with normal email; Google sign-in lands people on the student page. An EOD submitted Tuesday overrides the one submitted Monday.

### Issue
Three separate root causes:
1. **Email signup** — Supabase "Confirm email" is ON while the project still uses the built-in mailer (`noreply@mail.app.supabase.io`). Auth logs (2026-07-13) show `over_email_send_rate_limit` 429s; confirmation links never arrive, so accounts stay unconfirmed and sign-in fails with "Invalid login credentials". The UI made it worse by toasting "Account created — you're in" even when no session was returned.
2. **Google → student page** — `info@ivysalesacademy.com` and `abdulrahmane458@gmail.com` carried a dangling `student` role in `user_roles` (assigned earlier when a `students` row with a matching email existed; the `students` table now has zero emails). The role-based landing in `_authenticated.tsx` sends `student && !team` to `/student-portal`. Current signup triggers are correct — no blanket student assignment.
3. **EOD overwrite** — `report_date` was silently derived from the device clock (`todayLocal()`). A rep finishing after midnight (or with a wrong device timezone) filed Monday's report under Tuesday's date; the next day's upsert on `(user_id, report_date)` then replaced it.

### What I did
- Deleted the two stale `student` rows from `user_roles` (live DB, verified no `students` rows referenced those accounts).
- `auth-page.tsx`: signup now checks `data.session` — when confirmation is pending it says "confirm via the link in your inbox" and switches to the sign-in tab instead of claiming success.
- `_authenticated.eods.tsx`: added an explicit report date with a Today/Yesterday toggle; the form header shows which day is being filed and warns "Already submitted for this day — saving replaces it" when editing; drafts are keyed per report date; the top-bar "Today submitted/pending" chip now reflects today regardless of the selected date; the `isa:eod-submitted` event only fires for today's date; a midnight-crossing tab snaps back to a valid date.

### How I did it
- Diagnosis via Supabase MCP: `auth.users` + `user_roles` query, auth service logs, live `handle_new_user`/`link_student_on_signup` definitions, `students` email count (0 of 48).
- Files: `src/routes/_authenticated.eods.tsx`, `src/components/auth-page.tsx`. Added `shiftDay` helper (noon-anchored to survive UTC conversion). `npx tsc --noEmit` and `npm run build` pass.

### What was challenging
The overwrite had no DB evidence yet (only demo EODs), so the mechanism was established from code: `todayLocal()` + silent upsert means any two submissions resolving to the same local date collide. Yesterday-only backdating was chosen deliberately — arbitrary backdating would weaken the EOD history rules.

### Future work
- **Manual step pending:** Supabase Dashboard → Authentication → Sign In / Providers → Email → disable "Confirm email" (portal is invite-gated), or configure custom SMTP. Until then email signup stays broken regardless of UI.
- Changes are uncommitted; production is fixed only after commit + push to main (Vercel).
- Consider surfacing dangling `student` roles (role without a matching `students` row) in the admin Team page.

---

## Update (same day): demo data removed

User asked to "disable fake data". Ran `npm run demo:remove` — removed 48 demo students (plus cascaded installments/calls/notes/testimonials), 613 demo EODs, 48 demo deals, 29 action items, 3 IG snapshots, and the 8 `@isa.demo` accounts. `adam@isa.demo` survived the script because a `team_chat` message and a `student_alerts` row he authored blocked the auth delete, and the script ignored the error while logging success; cleaned both rows and deleted the user by hand. Patched `scripts/remove-demo.mjs` to clear `team_chat`/`student_alerts` by `created_by` and to log deleteUser failures. Verified: 0 demo users, 0 `is_demo` rows.

---

## Update (same day): tab-refocus redirect + 24h graph defaults

**Tab refocus → /eods redirect.** supabase-js re-emits `SIGNED_IN` whenever a tab regains visibility; `_authenticated.tsx` treated every such event as a fresh login and re-ran role-based landing, so returning to the portal tab from another tab shoved setters to /eods (closers → /sales, CSMs → /csm) no matter what page they were on. Fixed by tracking the already-loaded user id in the layout — a SIGNED_IN for the same user is demoted to a plain state refresh. Genuine sign-ins still land correctly via the one-shot `isa-landing-pending` sessionStorage flag, which is checked after the demotion.

**24h default ranges.** Founder asked for every graph to default to 24 hours. Changed defaults from 30d → 24h in dashboard, sales, revenue, and admin (all already had a 24H preset in the RangePicker), and Mochi CRM period from last_7_days → today. Fake-data removal re-verified: 0 demo users, 0 is_demo rows.

---

## Update 2026-07-14: scholarship, Team badge, Sets view rework

**Scholarship (deployed).** Founder was blocked placing a free student — the payment modal required total > 0. Added `scholarship` to the `payment_state` enum (migration `20260714080000`, applied live), a "Scholarship (free)" option in both the Set up payment modal and Add Student modal (no deal, no installment plan, full program access), a Scholarship badge in students list/detail, and updated the generated Supabase types by hand (two enum lines, avoiding a full-file regen).

**Team pending badge (deployed).** Red count badge on the Team sidebar entry (red dot when collapsed) while signups with no role are waiting to be placed. Count = active profiles minus anyone in user_roles; refreshes on navigation.

**Sets view (deployed).** Summary stat tiles (upcoming/unclaimed/reminder due/unconfirmed/confirmed), day-grouped list (Today/Tomorrow/weekday), and a per-set "N/4 reminders sent · 24h due now / next opens in Xh" line. Perf: gated the team Google Calendar fan-out on `pageView === "calendar"` so the Sets view doesn't pay for it, and made reminder/confirm ticks optimistic (instant chip flip, background reconcile) instead of a server round-trip + full list refetch.

---

## Update 2026-07-14 (second wave): money truth, portal overhaul, compliance

**Whop net cash (deployed).** Finance cash-in/profit/split, dashboard hero, and Revenue tile all read Whop NET (fees ~3.5% are real) via new getWhopCashWindow; auto-refresh 5min. Installment mark-paid checks Whop for a matching charge (findWhopMatch, ±$1/±3d) and warns; leaving paid clears paid_at; collected windowed by paid_at; payout queries require status=paid. **Blocker for founder: Whop is DISCONNECTED inside Mochi (last sync Jul 11) — reconnect at Mochi → Settings → Integrations.** The expected 2k (hishamkhan89) FAILED twice on Jul 10.

**Date-integrity sweep (deployed).** Audit found 3 more copies of the EOD-overwrite class: student portal EODs (UTC), CSM quick-EOD (Dubai tz), SOPs counter (UTC + stale localStorage date + partial payload wiping narrative — now merges). All use the rep's local day now. computeStreak was UTC-shifted for Dubai users — fixed. EOD delete confirms. Only one historical overwrite existed (Aalian Jul 12, pre-fix).

**Student portal (deployed).** Arabic salam, program-aware views (group = no coach/1:1), Start Here checklist (student_guide_steps table), leaderboard (server fn), KPI rework (outreach removed; 3 roleplays+3 looms pre-approval, 5 apps post), sidebar Journey/Library groups, new bottom nav.

**Also deployed:** per-student EOD-exempt toggle + student header spacing; CSM daily target (profiles.csm_daily_target, Team editor, EOD bar); sets-vs-expected graph + lighter expected bars; 24H defaults + 3D preset + shadcn DateField everywhere; setter claim-your-set bell pings + inline set notes; Close outreach-compliance sweep (per Lead Score tier; verified live: 229 leads, A-tier fully contacted, 17/40 B-tier uncontacted, 178 leads unscored).

---

## Update 2026-07-14 (third wave): access requests, cofounder EODs, fresh role guides

**Access requests → Students.** Portal-link signups now queue on the Students page ("Waiting for access", red badge on Students in sidebar); Team keeps a pointer + team-hire path.

**Cofounders exempt from EODs** (Faizan, Abu Bilal): no EOD-due chip, out of compliance roster and dashboard missing count.

**Per-role portal guides regenerated.** scripts/shoot-guide-assets.mjs: creates temp single-role accounts (setter/closer/csm/coach/admin+founder+cofounder), Playwright+Chrome logs in as each on prod, 26 role-correct screenshots at 1440×900 dark, deletes accounts (verified 0 left). Guide content updated for: DM setter = DMs sent, EOD Today/Yesterday toggle + local-day rule, new Sets view (claim pings, My sets, owner badges, per-reminder confirm, notes, 6h rule, Pathway-Onboarding-only), 24H presets + calendar picker, Whop-net cash, CSM daily targets (10/5) + student-side Start Here/loom loop section, scholarship option, access-requests flow, CRM outreach compliance, Gathering Hub removed, setter guide no longer references Sales/Revenue (setters lack access), stale Coaches-tab section replaced. Note: log-a-close-schedule screenshot kept from previous batch (dialog unchanged); all others fresh.
