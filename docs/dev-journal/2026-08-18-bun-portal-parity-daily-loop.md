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
