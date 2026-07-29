# Ivy Portal integrity and surface audit

**Audit date:** 2026-07-29
**Branch:** `fix/founder-home-setter-tracker`
**Scope:** authenticated routes, nested operational components, server-backed reads and writes, role gates, layout constraints, historical-data mutation, demo exclusion, and credential boundaries.

## Release position

This document records the source-level audit. It is not evidence that production has been migrated or deployed. Production verification belongs in the release section after the exact commit and migration are live.

## Canonical boundaries used in this audit

- Authenticated workspaces use the full available content width. Narrow widths remain only for reading columns, dialogs, forms, and empty or denied states.
- Money stakeholders `admin`, `closer`, `founder`, and `cofounder` may read approved money surfaces. Money mutation is limited to `admin` and `closer`. Destructive correction is narrower where the UI or RPC says admin-only.
- Deals, installment plans, installment payments, and EOD submissions are operational history. Corrections use void, waiver, or archive semantics rather than silent deletion.
- A paid installment row is immutable to normal authenticated callers after settlement.
- Demo profiles, demo students, and their dependent records do not enter operational aggregates.
- Service credentials and OAuth tokens remain server-side. A hidden UI control is never treated as authorization.
- Whop net cash and internally logged deal cash are separate measures and must not share a trend or comparison label.

## Confirmed findings and disposition

| Finding | Evidence | Disposition in branch |
|---|---|---|
| Authenticated pages used competing `max-w-*` containers | Shared shells and many routes independently constrained width | Shared workspaces now use `w-full max-w-none`; a contract test rejects page-level fixed-width regressions |
| Coaches and CSMs could delete student EOD history | Existing DELETE grants and RLS policies on student EOD tables | Direct DELETE revoked; admin correction archives source JSON before unlocking resubmission |
| Calendar OAuth tokens were selectable through authenticated PostgREST | Token-bearing columns lived beside safe connection metadata | Authenticated column grants expose only safe metadata; token reads use the privileged server client |
| Close CRM service-backed reads relied partly on route hiding | Server functions used privileged credentials without a uniform caller guard | Status, list, detail, and compliance functions enforce Close pipeline eligibility |
| Student leaderboard service-role read lacked a complete caller eligibility check | Privileged aggregate could be invoked beyond the intended active student state | Active, non-demo, onboarded student eligibility is enforced server-side |
| Self profile updates could change managed payroll or operational fields | Broad own-profile UPDATE policy | A database trigger rejects changes to protected fields while allowing initial setter-type setup |
| Historical money rows could be deleted or reconstructed | Client DELETE paths existed for deals, plans, and scheduled payments | Deals and plans are voided, unpaid schedules are waived, DELETE is revoked, and paid rows are database-locked |
| Revenue showed Whop net with a logged-deal sparkline and delta | Headline source and comparison source differed | Logged comparison visuals are hidden whenever Whop is the active headline source |

## Authenticated route inventory

Generated from 44 authenticated route files. Role entries are explicit `roles.includes(...)` checks in that file. Database entries are direct calls in that file; nested component and server-function boundaries follow in later sections.

| Route | Source | Explicit roles | Direct tables | RPC or server functions | Tabs | Width tokens |
|---|---|---|---|---|---|---|
| `/_authenticated/action-items` | `src/routes/_authenticated.action-items.tsx` | `admin`<br>`closer`<br>`coach`<br>`csm`<br>`setter` | `profiles`<br>`student_action_items`<br>`student_calls`<br>`students` | `listTeamMembers` | None in file | `max-w-md`<br>`max-w-none` |
| `/_authenticated/admin` | `src/routes/_authenticated.admin.tsx` | `admin` | `audit_log`<br>`calendar_connections`<br>`commission_rates`<br>`eods`<br>`eods_activity_real`<br>`founder_settings`<br>`org_settings`<br>`payment_links`<br>`profiles`<br>`role_access`<br>`student_calls`<br>`students`<br>`user_roles` | None in file | None in file | `max-w-3xl`<br>`max-w-none` |
| `/_authenticated/analytics` | `src/routes/_authenticated.analytics.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/calendar` | `src/routes/_authenticated.calendar.tsx` | `admin` | `profiles`<br>`user_roles` | `assignSet`<br>`cancelSet`<br>`claimSet`<br>`createSetReminder`<br>`disconnectMyCalendar`<br>`getMyCalendarConnection`<br>`getTeamCalendarEvents`<br>`getTeamCalendarStatus`<br>`listUpcomingSets`<br>`restoreSet`<br>`startGoogleCalendarAuth`<br>`syncCalendlySets`<br>`unclaimSet`<br>`updateSetTracking` | None in file | `max-w-40`<br>`max-w-52`<br>`max-w-md`<br>`max-w-none` |
| `/_authenticated/calls` | `src/routes/_authenticated.calls.tsx` | `admin`<br>`coach` | `profiles`<br>`student_calls`<br>`students`<br>`user_roles` | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/chat` | `src/routes/_authenticated.chat.tsx` | `admin` | `profiles`<br>`students`<br>`team_chat` | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/closer-resources` | `src/routes/_authenticated.closer-resources.tsx` | `admin`<br>`closer` | `payment_links` | None in file | None in file | `max-w-3xl`<br>`max-w-full` |
| `/_authenticated/crm` | `src/routes/_authenticated.crm.tsx` | `admin`<br>`closer`<br>`cofounder`<br>`founder` | None in file | `deleteCloseApiKey`<br>`getCloseContactCompliance`<br>`getCloseStatus`<br>`listCloseLeads`<br>`saveCloseApiKey`<br>`testCloseConnection` | None in file | `max-w-2xl`<br>`max-w-md`<br>`max-w-none` |
| `/_authenticated/csm` | `src/routes/_authenticated.csm.tsx` | `admin` | `csm_student_notes`<br>`csm_tally`<br>`eods`<br>`profiles`<br>`student_action_items`<br>`student_calls`<br>`student_eods`<br>`student_weekly_eods`<br>`students` | None in file | None in file | `max-w-2xl`<br>`max-w-md`<br>`max-w-none` |
| `/_authenticated/customers` | `src/routes/_authenticated.customers.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/dashboard` | `src/routes/_authenticated.dashboard.tsx` | `setter` | `eods_activity_real`<br>`installment_payments`<br>`profiles`<br>`student_action_items`<br>`student_calls`<br>`student_eods`<br>`students`<br>`user_roles` | `pending_signups` | None in file | `max-w-2xl`<br>`max-w-full`<br>`max-w-xl` |
| `/_authenticated/directory` | `src/routes/_authenticated.directory.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/eods` | `src/routes/_authenticated.eods.tsx` | `admin`<br>`closer`<br>`coach`<br>`csm`<br>`founder`<br>`setter` | `eods`<br>`profiles` | None in file | `mine`<br>`submit` | `max-w-none` |
| `/_authenticated/finance` | `src/routes/_authenticated.finance.tsx` | `cofounder`<br>`founder` | `business_expenses`<br>`commission_rates`<br>`deals`<br>`founder_settings`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`user_roles` | `findWhopMatch` | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/installments` | `src/routes/_authenticated.installments.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/knowledge/$slug/edit` | `src/routes/_authenticated.knowledge.$slug.edit.tsx` | `admin` | `docs` | None in file | None in file | None in file |
| `/_authenticated/knowledge/$slug` | `src/routes/_authenticated.knowledge.$slug.tsx` | `admin` | `docs`<br>`profiles` | None in file | None in file | `max-w-none` |
| `/_authenticated/knowledge/` | `src/routes/_authenticated.knowledge.index.tsx` | `admin`<br>`closer`<br>`setter` | `docs` | None in file | None in file | `max-w-none` |
| `/_authenticated/knowledge/new` | `src/routes/_authenticated.knowledge.new.tsx` | `admin` | `docs` | None in file | None in file | `max-w-none` |
| `/_authenticated/knowledge` | `src/routes/_authenticated.knowledge.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/mochi` | `src/routes/_authenticated.mochi.tsx` | `admin`<br>`founder` | None in file | None in file | None in file | `max-w-md` |
| `/_authenticated/payouts` | `src/routes/_authenticated.payouts.tsx` | Inherited or data-driven | `commission_rates`<br>`deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`user_roles` | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/performance` | `src/routes/_authenticated.performance.tsx` | Inherited or data-driven | `eods_activity_real`<br>`profiles`<br>`user_roles` | None in file | None in file | `max-w-full`<br>`max-w-xl` |
| `/_authenticated/policies/crm-hygiene` | `src/routes/_authenticated.policies.crm-hygiene.tsx` | Inherited or data-driven | None in file | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/policies/eod-hygiene` | `src/routes/_authenticated.policies.eod-hygiene.tsx` | Inherited or data-driven | None in file | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/policies/` | `src/routes/_authenticated.policies.index.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/policies` | `src/routes/_authenticated.policies.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/profile` | `src/routes/_authenticated.profile.tsx` | Inherited or data-driven | `avatars`<br>`profiles`<br>`students` | `syncStudentTimezone` | None in file | `max-w-none` |
| `/_authenticated/revenue` | `src/routes/_authenticated.revenue.tsx` | `admin`<br>`closer`<br>`founder` | `commission_rates`<br>`deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`students`<br>`user_roles` | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/sales-hq` | `src/routes/_authenticated.sales-hq.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/sales` | `src/routes/_authenticated.sales.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/sops/dm-setting-mastery` | `src/routes/_authenticated.sops.dm-setting-mastery.tsx` | Inherited or data-driven | None in file | None in file | None in file | `max-w-3xl`<br>`max-w-4xl` |
| `/_authenticated/sops/isa-setting-process` | `src/routes/_authenticated.sops.isa-setting-process.tsx` | Inherited or data-driven | `eods` | None in file | None in file | `max-w-3xl`<br>`max-w-lg`<br>`max-w-none`<br>`max-w-sm` |
| `/_authenticated/sops` | `src/routes/_authenticated.sops.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/student-portal` | `src/routes/_authenticated.student-portal.tsx` | Inherited or data-driven | `docs`<br>`org_settings`<br>`profiles`<br>`student_action_items`<br>`student_call_attendance`<br>`student_calls`<br>`student_eods`<br>`student_guide_steps`<br>`student_placements`<br>`student_weekly_eods`<br>`students` | `student_toggle_action_item`<br>`beginPortalWalkthrough`<br>`completePortalWalkthrough`<br>`completeStudentOnboarding`<br>`getMyGraduationReview`<br>`getStudentLeaderboard`<br>`getStudentNextCall`<br>`reportOfferLanded`<br>`saveStudentWhatsapp`<br>`submitGraduationReview`<br>`syncStudentTimezone` | None in file | `max-w-none`<br>`max-w-xl` |
| `/_authenticated/student-success` | `src/routes/_authenticated.student-success.tsx` | Inherited or data-driven | `csm_student_notes`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`student_action_items`<br>`student_calls`<br>`student_eods`<br>`students` | None in file | `action-items`<br>`digest`<br>`overview`<br>`testimonials` | `max-w-none` |
| `/_authenticated/students/$id` | `src/routes/_authenticated.students.$id.tsx` | `admin`<br>`closer`<br>`coach`<br>`csm` | `csm_student_notes`<br>`deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`student_action_items`<br>`student_calls`<br>`student_eods`<br>`student_milestone_progress`<br>`student_milestones`<br>`student_placements`<br>`student_weekly_eods`<br>`students`<br>`user_roles` | None in file | None in file | `max-w-none` |
| `/_authenticated/students/requests` | `src/routes/_authenticated.students.requests.tsx` | `admin`<br>`closer`<br>`csm` | `user_roles` | `pending_signups`<br>`approveAsStudent` | None in file | `max-w-none` |
| `/_authenticated/students` | `src/routes/_authenticated.students.tsx` | `admin`<br>`coach` | `deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`student_guide_steps`<br>`students`<br>`user_roles` | None in file | None in file | `max-w-2xl`<br>`max-w-none` |
| `/_authenticated/team` | `src/routes/_authenticated.team.tsx` | `admin`<br>`setter` | `avatars`<br>`onboarding_progress`<br>`profiles`<br>`user_roles` | `approveAsStudent`<br>`deleteTeamMember`<br>`setMemberActive` | None in file | `max-w-3xl`<br>`max-w-md`<br>`max-w-none` |
| `/_authenticated/team_/$id` | `src/routes/_authenticated.team_.$id.tsx` | Inherited or data-driven | None in file | None in file | None in file | None in file |
| `/_authenticated/testimonials` | `src/routes/_authenticated.testimonials.tsx` | `admin` | `students`<br>`testimonials` | None in file | None in file | `max-w-full`<br>`max-w-lg`<br>`max-w-none` |
| `/_authenticated` | `src/routes/_authenticated.tsx` | `cofounder`<br>`founder`<br>`student` | `eods`<br>`profiles`<br>`user_roles` | None in file | None in file | `max-w-md`<br>`max-w-xl` |
| `/_authenticated/work` | `src/routes/_authenticated.work.tsx` | Inherited or data-driven | `founder_settings` | None in file | None in file | None in file |

## Nested operational component inventory

Generated from 24 components that directly call Supabase, an RPC, or a TanStack server function.

| Component | Explicit roles | Direct tables | RPC or server functions | Width tokens |
|---|---|---|---|---|
| `src/components/account-settings.tsx` | Inherited from parent or server guard | `doc-assets`<br>`org_settings` | None in file | None in file |
| `src/components/app-sidebar.tsx` | `admin`<br>`closer`<br>`csm`<br>`student` | `org_settings` | `pending_signups` | None in file |
| `src/components/application-pending.tsx` | Inherited from parent or server guard | `profiles` | None in file | `max-w-lg` |
| `src/components/auth-page.tsx` | Inherited from parent or server guard | None in file | `signUpEmail` | `max-w-md` |
| `src/components/cash-in-calendar.tsx` | `cofounder`<br>`founder` | `business_expenses`<br>`commission_rates`<br>`deals`<br>`profiles`<br>`user_roles` | `findWhopMatch` | None in file |
| `src/components/checkin-coverage.tsx` | Inherited from parent or server guard | `profiles`<br>`students`<br>`user_roles` | None in file | None in file |
| `src/components/command-palette.tsx` | Inherited from parent or server guard | `docs`<br>`profiles`<br>`students`<br>`testimonials`<br>`user_roles` | None in file | `max-w-xl` |
| `src/components/csm-overview.tsx` | Inherited from parent or server guard | `csm_tally`<br>`student_calls`<br>`student_eods`<br>`student_placements`<br>`students` | None in file | None in file |
| `src/components/csm-today-queue.tsx` | Inherited from parent or server guard | `csm_student_notes`<br>`csm_tally`<br>`student_action_items`<br>`student_calls`<br>`students` | None in file | None in file |
| `src/components/expense-modal.tsx` | Inherited from parent or server guard | `business_expenses` | None in file | `max-w-md` |
| `src/components/home-setter-week.tsx` | Inherited from parent or server guard | `eods_activity_real` | None in file | None in file |
| `src/components/invite-modal.tsx` | `admin` | `invitations` | None in file | `max-w-md` |
| `src/components/mochi-crm.tsx` | Inherited from parent or server guard | None in file | None in file | `max-w-none` |
| `src/components/notifications-bell.tsx` | `admin`<br>`coach`<br>`setter` | `installment_payments`<br>`student_calls`<br>`student_eods`<br>`student_guide_steps`<br>`student_placements`<br>`students` | `pending_signups` | None in file |
| `src/components/payout-alert.tsx` | Inherited from parent or server guard | `commission_rates`<br>`deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`user_roles` | None in file | None in file |
| `src/components/revenue/payment-plans-section.tsx` | `admin`<br>`closer` | `profiles`<br>`students` | `findWhopMatch` | `max-w-3xl`<br>`max-w-sm` |
| `src/components/setter-tracking-sheet.tsx` | Inherited from parent or server guard | None in file | `completeSetFollowUp`<br>`getSetterTracker`<br>`listSetterTrackerMembers`<br>`scheduleSetFollowUp`<br>`updateSetLifecycle` | `max-w-3xl` |
| `src/components/student-bottom-nav.tsx` | Inherited from parent or server guard | `students` | None in file | None in file |
| `src/components/student-payment-setup.tsx` | Inherited from parent or server guard | `deals`<br>`installment_payments`<br>`installments`<br>`profiles`<br>`students`<br>`user_roles` | None in file | `max-w-lg` |
| `src/components/student-placements.tsx` | Inherited from parent or server guard | `student_placements`<br>`students` | None in file | None in file |
| `src/components/students-tab-bar.tsx` | Inherited from parent or server guard | None in file | `pending_signups` | None in file |
| `src/components/team-activity-log.tsx` | `admin` | `profiles` | None in file | None in file |
| `src/components/team-week.tsx` | `admin` | `eods`<br>`profiles`<br>`user_roles` | None in file | None in file |
| `src/components/ui/skeletons.tsx` | Inherited from parent or server guard | None in file | None in file | `max-w-none` |

## Privileged server-function inventory

This section identifies source files that define TanStack server functions or use the service-role client. The listed guard names are mechanically extracted and still require human review of their semantics.

| Source | Exported server functions | Tables touched | Caller guards found |
|---|---|---|---|
| `src/lib/auth.functions.ts` | `signUpEmail` | None in file | No `require*` guard name detected |
| `src/lib/calendar.functions.ts` | `assignSet`<br>`cancelSet`<br>`claimSet`<br>`createSetReminder`<br>`disconnectMyCalendar`<br>`getMyCalendarConnection`<br>`getTeamCalendarEvents`<br>`getTeamCalendarStatus`<br>`listUpcomingSets`<br>`restoreSet`<br>`startGoogleCalendarAuth`<br>`syncCalendlySets`<br>`unclaimSet`<br>`updateSetTracking` | `calendar_connections`<br>`profiles`<br>`set_reminders`<br>`user_roles` | `requireCalendarRole`<br>`requireSetOperationsAccess`<br>`requireStaffCalendarAccess` |
| `src/lib/close-crm.functions.ts` | `deleteCloseApiKey`<br>`getCloseActivityReport`<br>`getCloseBookedCount`<br>`getCloseCallStats`<br>`getCloseContactCompliance`<br>`getCloseLeadDetail`<br>`getCloseStatus`<br>`listCloseLeads`<br>`saveCloseApiKey`<br>`testCloseConnection` | `service_credentials` | `requireAdmin`<br>`requireClosePipelineAccess`<br>`requireCrmAnalyticsAccess` |
| `src/lib/crm-lead-notes.functions.ts` | `countLeadNotes`<br>`createLeadNote`<br>`deleteLeadNote`<br>`listLeadNotes`<br>`updateLeadNote` | `crm_lead_notes`<br>`profiles` | No `require*` guard name detected |
| `src/lib/growth-operator.functions.ts` | `seedIvyDoctrineWeek` | `content_items`<br>`content_week_ideas`<br>`content_week_plans` | `requireFounderOrAdmin` |
| `src/lib/mochi.functions.ts` | `findWhopMatch`<br>`getFinanceRevenue`<br>`getMochiDashboard`<br>`getMochiDetail`<br>`getMochiEodReference`<br>`getMochiHome`<br>`getMochiPayments`<br>`getMochiStatus`<br>`getTeamGoal`<br>`getWhopCashWindow`<br>`setTeamGoal` | `deals`<br>`founder_settings`<br>`installment_payments`<br>`service_credentials`<br>`user_roles` | `requireFinanceAccess`<br>`requireFounderAnalyticsAccess`<br>`requireFounderOrAdmin`<br>`requireMoneyAccess` |
| `src/lib/setter-tracker.functions.ts` | `completeSetFollowUp`<br>`getSetterTracker`<br>`listSetterTrackerMembers`<br>`scheduleSetFollowUp`<br>`updateSetLifecycle` | `eods_activity_real`<br>`profiles`<br>`set_follow_ups`<br>`set_reminder_events`<br>`set_reminders`<br>`user_roles` | `requireSalesTrackerAccess` |
| `src/lib/student-next-call.functions.ts` | `getStudentNextCall` | `calendar_connections`<br>`profiles`<br>`students` | No `require*` guard name detected |
| `src/lib/student-onboarding.functions.ts` | `completeStudentOnboarding` | `student_action_items`<br>`student_guide_steps`<br>`students`<br>`team_chat` | No `require*` guard name detected |
| `src/lib/student-portal.functions.ts` | `getStudentLeaderboard` | `student_eods`<br>`students` | `requireActiveStudentPortalAccess` |
| `src/lib/student-review.functions.ts` | `getMyGraduationReview`<br>`reportOfferLanded`<br>`submitGraduationReview` | `student_placements`<br>`students`<br>`team_chat`<br>`testimonials` | No `require*` guard name detected |
| `src/lib/student-timezone.functions.ts` | `saveStudentWhatsapp`<br>`syncStudentTimezone` | `students` | No `require*` guard name detected |
| `src/lib/student-walkthrough.functions.ts` | `beginPortalWalkthrough`<br>`completePortalWalkthrough` | `students` | No `require*` guard name detected |
| `src/lib/team-admin.functions.ts` | `approveAsStudent`<br>`deleteTeamMember`<br>`listTeamMembers`<br>`setMemberActive` | `profiles`<br>`students`<br>`user_roles` | No `require*` guard name detected |
| `src/lib/weekly-plan.functions.ts` | `ensureWeekProvisioned`<br>`generateWeekIdeas`<br>`promoteIdeaToSlot` | `content_items`<br>`content_week_ideas`<br>`content_week_plans` | `requireFounderOrAdmin` |

## Verification contract

- `tests/portal-integrity-contract.test.mjs` protects the shared width rule, calendar token boundary, money-history rules, paid-row trigger, EOD archive flow, Whop headline semantics, privileged aggregate eligibility, and self-profile protections.
- `tests/portal-reliability-contract.test.mjs` protects demo exclusion, historical EOD behavior, canonical analytics ownership, and repository release gates.
- Source inventory is evidence of coverage, not proof of runtime authorization. Database grants, RLS, RPC checks, and hosted verification remain authoritative.

## Remaining release verification

- [ ] Validate the new migration against the linked Supabase project with a dry run.
- [ ] Apply additive migrations in timestamp order and run `npm run supabase:verify`.
- [x] Run full Node test suite.
- [x] Run ESLint.
- [x] Run TypeScript without emit.
- [x] Produce a production build.
- [ ] Complete authenticated wide and mobile browser QA against the deployed exact commit.
- [ ] Verify founder, cofounder, closer, coach, CSM, setter, and student role outcomes against hosted RLS.
- [ ] Verify production deployment health and the Calendar Schedule, Sets, and Tracker views.

## Formatting note

Repository-wide `prettier --check` currently reports a broad pre-existing baseline across many untouched files. ESLint passes. This audit intentionally does not reformat unrelated files.
