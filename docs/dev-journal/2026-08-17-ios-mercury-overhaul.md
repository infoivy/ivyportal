# Log: iOS Mercury overhaul, rebrand assets, full-sweep data fixes

### Prompt
Founder (2026-08-17): change the app icon, logo (white line-art steamer basket), and startup animation; add skeletons; full sweep of portal/data gaps. Then mid-task pivot: a COMPLETE UI overhaul to Mercury banking's design language — every page, element, icon, font, weight — with the real Apercu fonts he supplied, both light and dark, Mercury login, dashboard, card view. Plan approved via plan mode.

### Issue
App was Mochi-dark; several signed-in surfaces silently showed fixture data; logo was a non-transparent crop (black box visible); founder wanted banking-grade professionalism.

### What I did
- **Assets**: scripted pipeline (scratchpad makeassets.swift, CoreGraphics) → luminance-to-alpha transparent centered logo PNG + Mercury-style app icon (ink mark on lavender gradient). AI button de-bordered (no stroke/glow), indigo disc.
- **Splash**: "steamed into existence" line-art animation (bottom-up wipe reveal, glow bloom, thin steam strokes, zoom-through exit), adaptive colors.
- **Design system**: adaptive light/dark tokens (`adaptive()` UIColor provider in Components.swift; light paper/white/ink/#5266EB indigo, dark deep-navy Mercury-accounts palette); radii 16/12/10; hairline borders + whisper shadows; Apercu Pro bundled (5 OTFs, UIAppFonts via project.yml) with `ivyFont`/`ivyNumber`/`ivyMoneyText` in new Typography.swift; regex sweep converted ~all `.font(...)` call sites, bold→medium (Mercury thin), thin-line tab icons (house/list.bullet/doc.text/person.2/gearshape), liquid-glass pill kept.
- **Mercury surfaces**: login card (AuthView), Home Overview balance hero (new `dailyCashSeries(days:)` in PortalAPI + cumulative indigo area chart, ↗in ↘out), Mercury sidebar drawer header, IO-style dark navy wallet card with wave Canvas texture + spent meter.
- **Full-sweep data fixes** (same session, pre-pivot): live Reports drill-downs (real EOD day/teammate series), live SetterActivityDetail (per-day member grid), live Payments Setters/Clients/Costs tabs, 1:1 tab = 1:1 students only + real calls-used (`studentCallCounts()`), calendar fixture rows gated from signed-in, DMs `max(dms_sent, leads_contacted)` parity fix.
- **Skeletons**: payment links, wallet, log-close picker, action/call composer spinners, student-detail depth reads, EOD setter-type row, team empty state; integrations rows stopped faking `live: true` (neutral grey dot).

### How I did it
Token-level recolor + regex passes (python) over Features/App/Core, then screenshot-driven QA on the booted iPhone 17 Pro sim in both appearances, fixing white-on-white leftovers (work-tab chip labels relying on Button tint, pulseStat/opsCell/stepper values, EOD submit label). xcodegen regen for fonts; build green; 62 unit tests pass; UI tests run at end.

### What was challenging
- zsh doesn't word-split unquoted `$2` — screenshot launcher passed args as one token, faking a "wrong screen" bug.
- SwiftUI Button labels inherit the global `.tint` (now indigo) — active indigo chips rendered invisible labels until given explicit foregrounds.
- Custom-font sweep must not touch SF Symbol `.font(.system(size:))` calls (kept system, thinned weights instead).

### Future work
- WidgetKit widgets (cash/tasks/EOD due) — founder-approved fast follow.
- Web portal Mercury rework (founder: "later").
- Founder may supply a new logo; rerun makeassets.swift.
- AI chat send is still not wired to a model; Organization/Tags/Content Hub/Socials remain marked local-only.

---

## Addendum: full IA rebrand (same day, ultracode)

Founder escalated to a complete rework ("remake everything, rearrange tabs, merge/delete"). Shipped:
- **New IA**: tab bar Home · Activity · Tasks · People · Money (Money = ex-Payments sheet promoted to a root tab, gated admin/founder/cofounder/closer in `RoleDestinationPolicy` — mirrors web /revenue+/payouts union). Settings moved off-bar into the Mercury sidebar (org header, view switcher, Knowledge, Settings rows). `-showPayments` launch arg now lands on the Money tab.
- **Home**: Mercury dashboard per picture — org row, quick-action pills (Log EOD/Log close/Log call/Add task via existing HomeActions), balance hero, accounts-style operating brief, transaction-row feeds; `EntityRow` uses replaced by Mercury `MemberRow` anatomy.
- **Surface remakes** executed as an ultracode workflow: six parallel agents with strict file ownership (Home+Search / Operations+PortalSurfaces / Performance trio / Customers+Testimonials / Payments+Payouts / Secondary), then six adversarial reviewers. Reviews caught: invisible-label chips, white-on-light chip text at low opacity ramps (drill-down day chips threshold raised to 0.75), half-converted TeamWeek day numbers, em dash in LogCallSheet placeholder, raw `.orange`, `.semibold` symbol weights, and one real business-rule bug — group students saw the student-detail "Calls" 1:1 tab + stat (now gated on `isOneOnOne`).
- **Tests**: policy tests extended (Money-tab gating, Settings-never-in-bar); UI tests updated to new labels (Tasks/People/Money). Final: 64 unit + 13 UI tests green; light and dark screenshots verified.

---

## Addendum 2: the flat rework (founder rejected the card look)

Founder: "this is just a font and color change… I wanted a whole new app. Same style, same navbar, same everything" as Mercury mobile. Round three replaced the LAYOUT SYSTEM itself:
- **Flat-screen kit** in Components.swift: `MercuryHeader` (big left title + thin trailing controls), `SectionBand` (grey full-bleed band headers like Mercury's "TODAY"), `FlatRow` (transaction-row anatomy), `FlatDivider`.
- **Shell**: white ground; the floating glass pill + AI disc + push drawer are GONE. Bottom bar is Mercury-flat: edge-to-edge white, top hairline, thin unlabeled icons, indigo active. View switching/Knowledge/Settings/Ivy AI live in a Mercury "Switch accounts"-style bottom sheet opened from the header bun avatar ("Switch view").
- **Screens** (6-agent ultracode fan-out + adversarial review): every surface converted from card grids to flat hairline sections with band headers — Home is the Mercury phone home (org title, flat balance + chart, LAST 30 DAYS money in/out split, flat brief rows); People is banded by priority (NEEDS ATTENTION / ON TRACK / OFFER WON / SCHOLARSHIP) on top of the unchanged ClientPriority order; Tasks/Activity/Money/Settings all flat. Cards survive only where Mercury has them (IO wallet card, mini card, sign-in card, form sheets).
- Review fixes: leftover `.fill` glyphs, dead `PerformanceStatCard`. Drawer UI test replaced by `testAvatarOpensSwitchSheet`. Final: build green, 64 unit + 13 UI tests pass, light + dark verified by screenshot.

---

## Addendum 3: scorched earth — the Bun / Mercury-clone rebuild

Founder supplied 42 real Mercury iOS screenshots and ordered a from-scratch rebuild ("delete everything… exactly like these screenshots; screw the data, UI first"), as a generic sellable info-business app. Done:
- Deleted the entire old feature layer + shell (git history retains it); PortalAPI/AuthStore/IvyPortalCore stay in-tree unused for the coming data phase; unit tests on core logic still run.
- New `IvyPortal/Bun/` app: BunTheme (palette read off the references), BunComponents, BunFixtures, BunShell (Mercury floating capsule bar: five thin unlabeled icons, active pill, gesture-based cells), five tab screens + money flows (transfer/deposit/send/request), settings/notifications/security/referral sheets, transaction detail with timeline + category picker, money-movement sheet with month bars and pager.
- Built via ultracode: 5 screen agents + 5 reviewers; coordinator fixed dead taps (home section routing, flow terminals, payments rows), locale-broken money ("$13.185.11" → en-US pinned), chart wash, single-initial avatars.
- Debug saga: tab switches flaked under XCUITest — proven NOT app logic via UserDefaults marker (actions fired); root causes: a flaky `.id`+`.transition` content swap (removed; Mercury switches instantly) and simulator scroll-delay swallowing Button taps on the floating bar (cells now `.onTapGesture`). Smoke suite green 3x consecutively; full suite: 64 unit + 4 UI tests pass.

---

## Addendum 4: data phase ("go") — real portal money in the Bun clone

Wired the live money domain into the Mercury anatomy via a new `BunStore` (IvyPortal/Bun/BunData.swift) over the existing PortalAPI + RLS session; signed-out DEBUG keeps fixtures, release greets with the login, Settings gains Sign in / Log Out (full refresh on sign-in):
- **Home**: welcome name from profile; headline + chart = cumulative collected cash 30d (dailyCashSeries); ↗ in ↘ payouts paid; month block = collectedCashMonth vs recurring expenses + payouts; Cards row = real wallet balance; transactions preview = live ledger.
- **Ledger** (Transactions): deals upfront cash + paid installments (in) + one-off expenses (out), day-grouped, skeleton/error/empty states, search.
- **Move money**: Inbox = overdue installments, Needs approval = unconfirmed payouts (period-labeled), Scheduled = upcoming — each row carries the real write (markInstallmentPaid / confirmPayout). "Send" becomes **Log close** signed-in: full Mercury-styled deal form (existing/new student, closer/setter, package, PIF/deposit/split, even-split plan) through PortalAPI.logClose, with the 15% set+close caption preserved verbatim.
- **Accounts**: Collected · month / Outstanding receivable / wallet balance. **Cards**: wallet card + spend meter + Log spend / Load card writes. **Movement sheet**: real 4-month in/out bars + top expense sources.
- Business rules untouched: RLS is the wall; commission/payout math stays in PayoutsCalc via payoutLedger. Build green; 64 unit + 4 UI tests pass.

---

## Addendum 5: data phase 2 ("continue") — clients, team, and the daily EOD

- **Accounts tab = client accounts**: signed-in, the linked-accounts section becomes the student roster as Mercury account rows — health-score circle (band-tinted), "paid X of Y" caption, phase tag — in the unchanged ClientPriority order (struggling 1:1 first, scholarship last). Row opens `BunClientSheet`: Mercury account page with tags (phase, 1:1/Group, Scholarship, At risk), paid-of-total block, top health signals, and that client's slice of the ledger. Group students gain no 1:1 surfaces.
- **Home team section**: EOD coverage % + sets this week (performanceSummary), opening `BunTeamSheet` (coverage hero + member rows with Filed today / Missed yesterday tags).
- **EOD due banner** on Home (only when `owesTodayEOD` — founders never see it; roles loaded first) opening `BunEODFlow`: Mercury-styled steppers gated by setter_type (phone: dials+sets · dm: DMs+sets · full cycle: dials+DMs+sets, targets 100/300·50/3·6 shown), shows/closes, required Wins, optional Blockers; INSERT-only submit with the locked-day (23505) case surfaced honestly ("already filed · ask an admin to unlock").
- Store additions: roster/health/paid-by-student/team/eodDue/setterType + refreshAll coverage. Build green; 64 unit + 4 UI tests pass.

---

## Addendum 6: data phase 3 ("continue") — CSM ops, sets, knowledge, testimonials

- **Accounts tab, CSM block** (gated to admin/csm/coach/founder/cofounder, the web /csm mix): "Today's tally" chips (Loom/Roleplay/Check-in/Escalation, optimistic +1 with long-press undo → csm_tally) and the coldest-first "Needs a check-in" queue (top 5 active non-graduated by days since last check-in; one-tap logCheckin with optimistic tick and error rollback).
- **Home "Upcoming sets"** (shows only when the signed-in user has claimed sets): prospect + friendly time + Confirm pill (confirmSet), unclaimed-count tag.
- **Knowledge** in Settings: live docs grouped by category with a read-only paragraph reader (editing stays web/admin-only).
- **Client sheet**: offer-won clients gain a "Request testimonial" chip (testimonials insert, status requested).
- Store: checkins/tallies/sets/docs loaders + optimistic writes with rollback. Build green; 64 unit + 4 UI tests pass.

---

## Addendum 7: reference gap-fill + functionality, and Bun-the-product

Functionality pass over the reference screenshots: Home range selector now live (7D/30D/90D reloading the cash series), Transactions gained working Method/Amount filters + a filter-reset icon + the "Match receipts" sheet (real PhotosPicker; matching itself marked as connecting later), Data-views rows open the movement sheet on the right segment, the movement month pager and bars are now selectable (per-month values), transaction detail actions work (Categorize persists per-row in-session and reflects on the chip, Copy Link → clipboard with feedback, notes editor saves per-row, attachments via PhotosPicker), card art opens a card page (freeze toggle, real wallet activity), "+" shows an honest create-card sheet, Settings gained Appearance/Help/Two-Factor screens, and the Accounts money rows route to their tabs.

Founder clarification recorded: **Bun is the product** — a multi-tenant SaaS (iOS + future web) that any info business signs into and gets their own portal; it will replace the Ivy web portal. Purged "portal" from all user-facing copy ("Sign in", "Bun on the web"), rebuilt the login as dark Bun-branded. Multi-tenancy (orgs, org-scoped RLS, self-serve onboarding, invites, web app) is the recorded roadmap, not yet built.

---

## Addendum 8: Bun multi-tenant Phase 1 (founder: "i say the word. go ahead")

**Backend** (migration written to `supabase/migrations/20260817210000_bun_multitenant_foundation.sql`, PENDING APPLY — the permission layer blocked direct DDL to production, correctly): purely additive — `orgs` + `org_members` (RLS'd, SECURITY DEFINER `is_org_member`/`is_org_admin` to avoid policy recursion), Ivy Sales Academy seeded as tenant #1 with every role-holder backfilled as a member, `org_id` (defaulted via `default_org_id()` + backfilled + indexed) on 23 business tables, `create_organization(name)` RPC (caller becomes owner/admin/founder of the NEW org only — no access to other tenants), additive org-admin invitation policies, and the signup trigger extended to enroll invitees/linked students into their org. Existing behavior untouched: legacy writers keep stamping Ivy by default; a brand-new business owner sees empty legacy tables (their RLS still keys on user_roles they don't hold) — correct isolation for Phase 1. Phase 2 (org-scoped RLS cutover + NOT NULL org_id + web rebuild) is deliberately separate and supervised.

**App**: `myOrgs()/createOrganization/inviteTeammate` in PortalAPI (graceful [] before the migration); BunStore org context (activeOrg, orgName, needsOrgSetup); Home org chip shows the real business name; signed-in accounts with no workspace get the "Name your business" flow; Settings gained "Invite teammates" (email + role chips → invitations, org-stamped when known); AuthView gained "Create an account" (Supabase signUp → business creation flow). Build green; 64 unit + 4 UI tests pass.

**Migration applied to production** (founder: "apply it"): verified — 1 org (Ivy Sales Academy), 49 members backfilled from user_roles, zero NULL org_ids across students/deals/eods/invitations, all 4 functions present, security advisors show no new errors (the three new SECURITY DEFINER functions match the pre-existing intentional RPC pattern). docs/DATABASE.md updated with the Phase-1 section and the Phase-2 cutover plan.
