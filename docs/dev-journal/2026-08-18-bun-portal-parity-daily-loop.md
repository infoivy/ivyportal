# Log: Bun portal parity, batch 1 (daily operating loop)

### Prompt

"go through the entire ivy portal, the code is in here and on github in the public repo. use it on the web, understand it fully and what it's for, and then lets bring the same functionality to the app."

Scope answers: staff surfaces first (student-facing portal after), first block = daily operating loop, "the home view in bun is not bad, it can do with some changes but dont overbloat anything".

### Issue

The Bun iOS app was a Mercury-styled money clone with a partial data layer. The web portal runs five jobs the app barely touched: accountability, money, fulfillment, the student's own portal, and admin. Nothing on the phone let anyone work an action item, log a coaching call, or read their own EOD week, and logging a close had been unreachable since the Money action chips were removed.

### What I did

- Read every route in `src/routes` and walked the live portal signed in as the founder (Home, Work, Performance, Money in, Payouts, Finance, Cards, Students, a student record, that student's own portal, CSM, 1-on-1 Calls, Testimonials, Action items, Calendar, CRM, Chat, Knowledge, Admin, Team).
- Produced the coverage map (portal surface → what Bun has) and a build order.
- Shipped the daily loop:
  - **Action items** — both web sources merged (ad-hoc `student_action_items` rows and the items inside `student_calls.action_items_json`), Open / Mine / Overdue filters, tick, delete, and a composer that inserts one row per target. Home gained a "Your items" section that renders only when the signed-in person owes something.
  - **1:1 call logging** — rating, coach notes, next step, action items, recording link; on the client account page beside the call history, gated on `calls_allotted > 0`.
  - **My EOD history** — last 7 days under the EOD form, showing only the metrics that person's setter type files.
  - **Log close** — reachable again from the Money title row.
  - **Dates** — one `BunStore.friendlyDay`, so nothing inside two weeks renders as a raw date (the ledger and the demo workspace were both leaking them).

### How I did it

- `PortalAPI.swift`: extended `StudentCall` (coach, status, rating, next step, Fathom, action items JSON) and added `ActionItemRow`, `CallActionItemRow`, `actionItems()`, `callActionItems()`, `setCallActionItemDone()`, `deleteActionItem()`, `teamMembers()`.
- `BunData.swift`: `BunTask` (one row shape for both sources), `tasks` / `myOpenTasks`, optimistic tick + delete + broadcast add, call history and `myEODs` loaders, and `friendlyDay` / `dayKey` as nonisolated helpers.
- New views `BunActions.swift` (hub + composer + row) and `BunCallLog.swift` (log flow + history).
- `BunFixtures.swift`: relative day labels, generated call history keyed off the same `callCounts` the roster shows, friendly due phrasing.
- `BunShell.swift`: `-bunSheet actions|eod|logClose|client|logCall` launch preset, presented one frame after launch.
- Verify: `xcodegen generate`, `xcodebuild` (Debug, iPhone 17 Pro sim), `swift test` (64 pass), simulator screenshots of every new surface.

### What was challenging

- Two action-item sources with different identities: call items live inside a JSON array with no row id, so ticking one is a read-modify-write of the array (the web does the same). The merged `BunTask` id encodes the source.
- Signed-out parity: every new surface has to render from fixtures, and the first cut left a client with "9 of 10 calls used" showing a permanent loading skeleton because `loadCalls` returned early without seeding an empty list.
- `xcrun simctl launch` under zsh does not word-split an unquoted variable, so a batched screenshot helper silently passed all launch arguments as one string and every preset looked broken.
- The Claude Code iOS Simulator MCP needs a full Xcode selected (`xcode-select` points at CommandLineTools here), so all screenshots went through `simctl` with `DEVELOPER_DIR` set.

### Future work

In value order: Home's Sales/Delivery picture tiles with exact-element routing, Performance (metric chart, filters, day drilldown), Money in analytics + payment plans, the Payouts ledger with base pay and adjustments, Finance, per-member card ledgers, Students kanban with filters, the deep student record, CSM workspace, testimonials, calendar + log-a-set + setter tracker, CRM, team chat, knowledge SOPs/policies, admin + team administration. Then the student-facing app mode, which is still entirely absent.

---

## Batch 2 — tab merge and the home pictures

### Prompt

"turn money and banking into one and then add one more item in navbar. because we need to add some more stuff. then also start with what you wanted"

### What I did

- Folded Banking into Money: `BunBanking` gained an `embedded` mode and renders as sections (accounts, cards, wallet) under the payments block. Its account rows lost their chevrons, because the surface they linked to now sits directly above them.
- Added the Work tab in the freed slot: today's EOD (status plus the week behind it) and the action-items queue inline. `BunActionItemsView(embedded:)` is one implementation used by both the tab and the sheet; Home's "Your items" now routes to the tab.
- Brought over the two home pictures, each to the tab that owns its rows:
  - `PortalAPI.salesPicture()` mirrors `home-sales-picture.tsx` — live sets since Monday, attendance-based show rate, yesterday's dials/DMs/sets summed per setter against `kpiTargets(for:)`, and closes in the current payout period.
  - The delivery read is computed in `BunStore.delivery` off the roster the Clients tab already holds, so the tiles and the rows they filter can never disagree. `ClientFilter` turns each tile into a roster filter.
- Home gained show rate on the Team strip and a matching Clients strip; nothing else on Home moved.
- `StudentRosterItem` now selects `created_at`, `onboarding_completed_at`, `first_win_at`, `testimonial_collected`.

### What was challenging

- Deciding what the sales block should NOT show: the Team funnel already answers sets/shows/closes from EOD rows, and the set records answer the same questions from a different source. Showing both would have been two truths on one screen, so the block only carries what the funnel cannot answer.
- Stat captions overflowed their third of the row into the neighbouring column ("11 showed · 3 did not" ran into the period label). Fixed by clipping each caption to its column frame and shortening the copy.
- The first Home strip test passed without ever scrolling: XCUITest counts off-screen elements as existing, so the assertion was meaningless until it scrolled first and checked `isHittable`.

### Future work

Unchanged from batch 1, minus the pictures: Performance depth, Money in analytics and payment plans, Payouts, Finance, per-member cards, the deep client record, CSM workspace, testimonials, calendar and log-a-set, CRM, chat, knowledge, admin. Then the student app mode. The Work tab is the intended home for schedule, knowledge and chat.

---

## Batch 3 — performance depth, money depth, and a density correction

### Prompt

"go ahead" (continue with Performance and the money block), then mid-build: "change the money icon to the previous bank icon. also remove request in money" · "your cards should be a different tab in the money page" · "same with bun accounts, make bun accounts and cards 1 tab" · "fix the spacing here its too cramped" · "those 6 tiles in clients takes way too much space and just looks ugly and unprofessional, doesnt fit the app style. use different elements."

### What I did

- **Team**: 7/30/90 range driving the funnel, graph and member rows; one canonical activity graph with a metric picker (calls booked / shows / closes / dials / DMs / convos) and bar intensity tracking each day's share of the peak; member rows became taps into `BunMemberSheet` — their days, their numbers, and the wins and blockers they wrote.
- **Money**: a Money / Accounts segment inside the tab, the bank glyph in the bar, Request removed, payments rows given real height and gaps, and three new sheets — `BunMoneyInSheet`, `BunPaymentPlansSheet`, `BunPayoutLedgerSheet` (period nav, commission/base-pay breakdown, mark paid, adjustments, with a demo ledger so the flow works signed out).
- **Clients**: the six-tile grid became one summary line plus a horizontal chip rail, each chip still filtering the roster, zero-count chips hidden.

### What was challenging

- The payout ledger renders from `PayoutLedgerData`, which the signed-out path never produced, so the demo workspace showed a permanent skeleton. It needed a fixture ledger plus demo-mode confirm and adjustment paths that fold into it.
- `xcodegen generate` has to run before a build after adding a file, or the new types are "not in scope" while the file sits on disk looking fine.
- The cards smoke test broke the moment cards moved behind the Accounts segment — fixed by launching with `-bunMoneySection accounts` rather than asserting against the default view.

### Future work

Finance (needs founder_settings for the cash goal and profit split), per-member card ledgers, the deep client record, CSM workspace, testimonials, calendar and log-a-set, CRM, chat, knowledge, admin. Then the student app mode. The founder's density note applies app-wide: exception counts belong in chips or rows, never in grids of boxes.

---

## Batch 4 — Finance

### What I did

- `PortalAPI.finance()` mirrors the web page's month: cash in (deal upfront + paid instalments), expenses (recurring plus this month's one-offs), payouts for BOTH semi-monthly halves, what is still scheduled, and a flow of what lands and what leaves before month end. Profit is computed after payouts, never just after expenses.
- Finance is a third tab inside Money, and the tab only exists for founder and co-founder — RLS is still the wall, this just avoids offering a surface that comes back empty.
- Cash in reads against `founder_settings.monthly_cash_goal` with a pace projection; expenses can be added and deleted from the phone.
- `friendlyDay` now reads forward as well (Tomorrow / weekday / "Next Wednesday"), because scheduled money is future-dated and the no-raw-dates rule covers the next two weeks the same as the last two.

### What I deliberately left out

The web's profit split is a hardcoded constant with three real names in it. That cannot ship in a multi-tenant product, so the app shows profit without the split until it becomes a per-org setting.

---

## Batch 5 — card ledgers, the client record, the CSM workspace

### Prompt

"go ahead with all"

### What I did

- **Card ledgers** (`PortalAPI.cardLedgers`, `BunCards.swift`): per person, loaded and spent all-time, balance, entries grouped by month with carry-in and carry-out. Load, spend and set-balance all write append-only entries — a correction is its own row, so the ledger stays a history rather than an edit log. Replaced the single wallet meter on the Accounts pane.
- **Client record** (`BunClientSheet` rewritten): a segment over Overview / Calls / Reports / Notes / Money. Overview holds the standing (status, coaching burn-down, health, last report, last check-in), the phase and coach pickers, check-in and log-a-call, money standing, placements and the graduation checklist. Reports carries daily and weekly self-reports with what they wrote; Notes has a composer over the CSM note history.
- **CSM workspace** (`BunCSM.swift`, opened from the Clients header, gated to the fulfillment roles): landed roles, success rate, first wins, the phase distribution as a bar, the one-tap tally with long-press undo, 14 days of client output, and the team's latest notes.

### What was challenging

- Group clients must never grow 1:1 surfaces, and the record has five tabs for a 1:1 client and four for a group one. Indexing the segment by position would have shown the wrong pane; the selected tab is resolved by NAME so a missing Calls tab cannot shift Reports into its slot.
- Five segment labels did not fit on a phone and "Overview" wrapped mid-word. `BunSegment` now scales its labels instead of wrapping.
- A four-item phase legend had the same problem and became a scroller.

### Future work

Testimonials, calendar and log-a-set, CRM, team chat, knowledge SOPs, admin and team administration. Then the student app mode. The profit split still needs to become a per-org setting before Finance can show it.

---

## Batch 6 — the profit split as an org setting, and the last web-only surfaces

### Prompt

"add the per org setting, call the org ivy sales academy, and also do the rest of the things u just mentioned"

### What I did

- **Migration `20260818040000_org_profit_split.sql`, applied to production.** `orgs.profit_split jsonb` plus an `orgs_admin_update` policy (owner/admin/founder of that org, via the existing SECURITY DEFINER helper) and a seed of the 70/15/15 rows onto tenant #1. The org was already named "Ivy Sales Academy", so nothing was renamed. Finance now renders the split from the org, and Settings has an editor that validates the total against 100%.
- **Testimonials**: the pipeline (requested → received → approved → published) with one-tap advance, filters, and the client-side request already on the record. Video and image uploads stay on the web.
- **Team channel**: the real `team_chat` table, General/Issue/Tip/Bug, posts as the caller, follows new messages to the bottom.
- **Log a set**: writes the `set_reminders` row every set surface in the app reads. The Google Calendar event stays a web job and the flow says so.
- **Knowledge**: the seven playbooks bundled in `IvyPortal/Resources/SOPs` (which had been dead weight since the rebuild) plus the org's docs, in one shelf with a plain markdown reader.
- **Team administration**: roles, the EOD-exempt toggle, and the waiting-to-be-let-in queue with role assignment.
- All four open from the Work tab shelf or Settings, so no new root tab.

### What I did not do

CRM. The Close pipeline and the Mochi dashboard are both served by TanStack server functions holding admin-only API credentials; there is no Supabase table for the app to read, so a CRM screen on the phone would either be empty or would need those credentials on the device. It needs an edge function first.

### Fixes found by screenshot

An em dash in a fixture message and another in a card-ledger caption (the copy rule forbids them), and `BunIconRow` subtitles wrapping to three lines in the Work shelf — one line with a tail truncation now.

---

## Batch 7 — the surfaces that existed only in the data layer

### Prompt

"continue,. still stuff missing from from app thats in portal"

### How I found them

Rather than re-reading the web routes, I listed every `PortalAPI` function with zero call sites in the app. That produced the honest gap: work that had been built and wired to Supabase but had no screen to render into.

### What I did

- **The bell.** `portalAlerts` already computed exactly what the web's notification bell shows, family by family and role-gated, and nothing rendered it. Home's top row now carries a bell with the web's badge tone (red while anything urgent is open), opening the alert list.
- **Payment links.** `paymentLinks` was unused. Closers now have them on the Money tab, tap to copy, which is the whole job on a call.
- **Money corrections.** Waive and refund were in the API and unreachable. Both sit behind a hold on an instalment row (not next to "Came in", where they would be fat-fingered), both demand a reason, and both leave the row on the record.
- **Profile editing.** The screen said "name and photo edits arrive with the profile editor". It now edits display name, phone, setter type and timezone — the last two being load-bearing: setter type decides which fields the EOD form asks for, timezone decides which day a late-night report files against.
- **Client record**: their open items, and Archive (never delete: they leave every roster while money and reports stay).

### Still unreachable, deliberately

`roleAccess` (admin access-defaults grid), `updateProcessorBalance`, `unconfirmPayout` / `deletePayoutAdjustment` (undo paths), testimonial file upload, and the analytics duplicates (`setterDailyLogs`, `studentOutput`, `activityDrilldown`, `moneySummary`) whose numbers already appear elsewhere.

---

## Batch 8 — CRM, through an edge function

### Prompt

"i need the crm data, just like what we had in ivyportal ios app and in the web portal, like the mochi app"

### Issue

I had left CRM out twice, correctly: Mochi's OAuth tokens and the Close API key live in `service_credentials`, admin-only by RLS. The web reaches them through TanStack server functions running on the server; the phone had no equivalent, and shipping either credential to a device was never an option.

### What I did

Built the missing server. `supabase/functions/crm-summary` (deployed, `verify_jwt` on):

1. Verifies the caller's JWT with their own client and role-checks through `has_role` — Mochi analytics for admin/founder/cofounder, Close pipeline for those plus closers, exactly the web's gates.
2. Reads the credentials with the service role. They never enter the response.
3. Refreshes Mochi's access token when it has expired and writes the rotation back, so web and app share one live token rather than fighting over it.
4. Calls Mochi's MCP endpoint (`get_message_counts`, `get_funnel_trend`, `get_lead_source_breakdown`, `get_payment_overview`) and Close's lead API, and returns derived numbers only.

The app side is `PortalAPI.crmSummary(period:)` and `BunCRMSheet`, opened from the Team tab: collected/gross/payments, DMs out/in and active conversations, the funnel as one bar per stage with the drop-off visible, new leads by day, lead sources, DMs by setter, then the Close pipeline with its stages.

Verified that all five credential rows are present in production, so the live app has real data to draw rather than a "not connected" state.

### What was challenging

Mochi's endpoint answers either plain JSON or a single SSE frame, and its payload is a JSON string nested inside the JSON-RPC result. The web already handled both; the edge function had to carry the same parsing rather than assume one shape.

---

## Batch 9 — the CRM read, matched against the real Mochi app

### Prompt

"the crm is lacking some stuff, here's mochi" (fourteen screenshots of the Mochi app: account health ring, lead/seat/contact limits, latest activity, the Default Funnel, Performance with active hours, setter replies and script analysis, and per-setter message tables).

### How I closed the gap

The Mochi MCP is connected to this session, so rather than guessing field names off screenshots I called the tools directly and read the real shapes: `get_account_health`, `get_account_overview`, `get_funnel_metrics`, `get_lead_reply_rate`, `get_setter_metrics`, `get_message_time_distribution`. Then the edge function (version 2) fetches all ten Mochi tools in parallel and the app renders them.

### What the CRM sheet gained

- **Account health first**, because a restricted account stops everything: status, the handle, active flag count, and the 24-hour send/failure numbers behind it.
- All leads and new-in-30-days.
- **Reply rate** beside the DM counts, and **median reply time** in Mochi's own shape ("22m", "3h 15m").
- **Pipeline now**: the live stage census (new, in contact, qualified, booked, won, unqualified) as one bar per stage, with conversion stated *separately* underneath. Mochi's own API note is explicit that a snapshot is never a conversion denominator, and the app says it the same way.
- **When leads message**: the hour-of-day distribution, shifted from the API's UTC into the reader's timezone, with the busiest hour called out.
- **By setter**: sent, replied, and reply rate together, because volume without replies is not performance.

### What was challenging

The fixture was one nested literal and the Swift type checker gave up on it ("unable to type-check this expression in reasonable time"). Rebuilt as step-by-step assignments.

---

## Batch 10 — setter activity, and a tab each for Mochi and Close

### Prompt

"When I click on the times that people message, I wanna be able to see, per setter, what time they messaged and how many messages, just like what Mochi has ... In the CRM section, have one tab for Mochi and one for Close, because Close has different numbers as well."

### What I did

- **Mochi and Close are separate tabs** in the CRM sheet. They count different things and stacking them invited comparisons between numbers that do not correspond.
- **The hours chart is a tap** into `BunSetterActivitySheet`: total messages in the window, hour-of-day in the reader's own timezone, day-of-week, and a row per setter with messages, replies, reply rate as a bar, time online per day, and days active.
- Edge function v3 adds `get_message_dayofweek_distribution` and `get_setter_active_windows`, and merges three Mochi tools into one row per setter (reply-rate breakdown, message counts, active windows).
- **The Close tab gained its own numbers**: dials, new leads and average call length from Close's activity report, plus the twenty most recently touched leads with status and value.
- `BunSegment` options now carry an accessibility identifier, because a segment option and a close chip can both be called "Close" and the tap became ambiguous.

### The honest limit

Mochi's app draws a setter-by-hour grid. No MCP tool returns that cross-tab: hours come from `get_message_time_distribution` (whole team) and per-setter numbers come from three other tools (totals and active windows). Rather than invent a split, the sheet shows the real per-setter numbers beside the team's hours and says so on screen.
