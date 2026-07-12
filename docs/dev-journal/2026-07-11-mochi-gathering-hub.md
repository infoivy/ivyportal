# Log: Mochi Instagram CRM integration + The Room (dither charts, fireplace) + sidebar scroll

### Prompt
1. Integrate themochi.app (Instagram CRM) via its MCP so the dashboard shows live IG leads/conversations/DMs/comments; Close CRM later; ties into EODs eventually.
2. Rebuild the Gathering Hub as a cozy founder data room with tripwire.sh/dither-kit-style charts and a fireplace — all company data, simply.
3. Whop API key provided for the hub.
4. Replace the ugly native sidebar scrollbar with the shadcn ScrollArea.

### Issue
Mochi has no public REST API — only an OAuth-protected MCP endpoint. The portal needed server-side, auto-refreshing access to it, plus founder-facing surfaces for the data.

### What I did
- **OAuth**: Mochi's auth server supports RFC 7591 dynamic client registration + PKCE. Registered a client, ran a localhost:8765 callback flow (user approved in browser), stored access/refresh tokens + client id in `service_credentials` (admin-only RLS), alongside the provided `whop_api_key`.
- **Server layer** (`src/lib/mochi.functions.ts`): `callTool()` speaks JSON-RPC to the MCP (handles SSE-framed responses), auto-refreshes the 24h access token, persists rotated refresh tokens. Server functions: `getMochiStatus`, `getMochiDashboard` (funnel trend + message counts + source breakdown in parallel), `getMochiPayments` (Whop/Stripe net revenue synced through Mochi). All gated founder/admin.
- **Dashboard**: `MochiIgSection` — "Instagram · via Mochi · live" card (new leads, conversations, DMs in/out, comment leads, booked + dither sparkline), 7D/30D toggle, 5-min refetch.
- **Gathering Hub**: new default tab "The Room" (`src/components/founder/the-room.tsx`) — Doom-fire dithered fireplace canvas (`dither-fireplace.tsx`, ~15fps, reduced-motion → static frame, pauses when tab hidden), KPI card (cash MTD, IG leads 30d, content this cycle, Whop net 30d), four dither charts: weekly cash bars, daily IG leads area (zero-padded — Mochi only returns active days), team dials+DMs stacked area, content-posted bars / lead-source donut.
- **Dither charts**: vendored Boring-Software-Inc/dither-kit (MIT, 33 files) into `src/components/dither-kit/`; added deps `motion`, `d3-scale`, `d3-shape`. The npm `@dither-kit/core` package is an empty placeholder — the real source is the GitHub repo's shadcn registry.
- **Sidebar**: `SidebarContent` in `ui/sidebar.tsx` now wraps children in the existing Radix `ScrollArea` — native scrollbar gone on desktop sidebar and mobile sheet alike.

### How I did it
Probed the MCP with curl (401 → `.well-known/oauth-protected-resource` → authorization server metadata), registered via the open registration endpoint, one-shot node script for the PKCE dance. Enumerated all 40+ tools; sampled `get_funnel_trend`, `get_message_counts`, `get_lead_source_breakdown` to fix types. Followed the existing `close-crm.functions.ts` credential pattern. Verified with tsc + build + Playwright screenshots using a temporary founder account (`ui-check@isa.demo`, deleted after). Local preview must run with `--env-file=.env` — server functions need non-VITE `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`.

### What was challenging
- Mochi's OAuth lives under `/api/zapier/oauth/` and the docs site 403s scrapers; everything was discovered via RFC well-known endpoints.
- The MCP answers with a single SSE frame on POST — the parser handles both framings.
- `npm i --no-save playwright` gets pruned by any later `npm i` — reinstalled for screenshots.
- Mochi trend data omits zero days; charts needed client-side zero-padding to read correctly with sparse data.

### Future work
- **EOD tie-in (user called it "absolute")**: pull per-setter DM/lead counts (`get_setter_metrics`, `get_member_metrics`) into the EOD form as prefill/verification.
- Close CRM second view: /crm already exists on API key; unify into a two-CRM switcher when he's ready.
- Direct Whop API integration (key stored) if Mochi's synced payment data proves insufficient.
- A "connect Mochi" admin UI for token re-auth without a terminal (tokens die if refresh fails repeatedly).
- Vercel env vars must include the SUPABASE_* server names (already true in prod for Close to work).

## Addendum — EOD reference + Room v2 (same day, ~10:30pm)

**Prompt:** "go" on the EOD tie-in, then: cash purely through Whop, hearth text out of the flames, student success rate, total leads (IG + Close) in team output.

**What changed:**
- `getMochiEodReference` server fn: matches the signed-in user to a Mochi member by email; personal scope returns their DMs out / sets / new leads, unmatched falls back to team-wide numbers with a "not linked" hint. Credential reads moved to the service-role client (`supabaseAdmin`) so setters get derived numbers without weakening the admin-only RLS on service_credentials. Reference only — per-field "use" buttons for DMs sent and Sets booked exist only in personal scope; nothing auto-writes (EOD KPI rules untouched).
- `MochiEodReference` strip renders inside the EOD Setting activity section.
- `getMochiPayments` reworked: 30d net/gross KPIs + 90d daily `gross_volume_series` from `get_payment_overview` (last_90_days is accepted).
- `getCloseLeadStats` in close-crm.functions: lead counts + per-day creation buckets via Close query `date_created >= …`.
- The Room: cash KPI + weekly bars now purely Whop; fireplace confined to the card's lower 55% with the meta line top-right; students strip (count · landed roles via `offer_landed_at` · success rate + bar); team output gains a third dither series: daily leads = Mochi funnel + Close created.

**Gotcha:** Mochi's team currently has only manager accounts + Sair — setters will hit team scope until they're added to Mochi with their portal emails (matching is by email).

## Addendum 2 — /mochi detail page, setter activity, mobile spacing (~10:45pm)

- New founder/admin route `/mochi`: headline stats (leads, active convos, DMs in/out incl. AI-assisted, qualified, booked), live pipeline census by stage, conversion cohort rates (new→qualified→booked→won), lead reply rate, median response time, response-time bucket bars, leads/bookings trend, source donut. Dashboard Instagram card links to it (chevron in header).
- `SetterActivityCard` on the dashboard: per-rep table joining Close call activities (dials, answered, avg duration — live: 221 dials, 1m55s avg) with Mochi per-member outbound DMs. `getCloseCallStats` pages `/activity/call/` — NOTE: activity endpoints cap `_limit` at 100 (leads allow 200); a 200 limit 400s and reads as "no calls".
- Instagram card mobile spacing: stats now a 3-col grid on phones (was uneven flex-wrap), sparkline full-width below.
- `getMochiDashboard` now returns `members` (per-member outbound DMs) for cross-CRM joins.

## Addendum 3 — 2026-07-12: chat, funnel viz, EOD fixes

- **Team Chat** (`/chat`, sidebar for all team roles): general channel cloned from the alerts pattern — `team_chat` table (kind: general/issue/tip/bug, team RLS, admin delete, permanent history), kind chips in composer, colored badges on non-general messages. Migration applied live via Supabase MCP + types regenerated.
- **Mochi-style funnel** (`mochi-funnel.tsx`): stage columns (New/In contact/Qualified/Booked call/Won) + smooth SVG ribbon (band height ∝ stage count, min floor, bezier segments, chart-1 blue ramp) + conversion % chips at boundaries + Unqualified/Deposit/No-show strip — replica of Mochi's dashboard funnel. Self-fetching panel in The Room; presentational version replaces the pipeline chips on /mochi. Also added Instagram CRM to the sidebar (admin/founder).
- **EOD fixes**: NumField draft-string state so backspace can clear (controlled number snapped "" → 0); "EOD due" chip clears on submit via `isa:eod-submitted` event; founder-approved KPI fold — "leads contacted/outreached" removed, DM setters 125 DMs sent, full-cycle 50 DMs sent, `outreachOf()` = max(dms_sent, leads_contacted) keeps historical KPI days intact (CLAUDE.md updated).
- Live data at verify time: 14 IG leads, 30 active convos, 58 DMs in / 26 out, 73% reply rate — the real team is onboarded and active.

## Addendum 4 — 2026-07-12 early AM: setter team visibility, EOD autofill, input + chip fixes

- **eods_activity view** (migration applied live): owner-rights view exposing team EOD *activity* columns to every team role — money columns (cash_collected, deposits, deferred_cash) stay behind the admin/closer-only RLS on the base table. Dashboard queries moved to the view; setters now see the collective volume trend/KPIs, with a **Team | Me** toggle (client-side filter) for their own numbers. Verified from a setter-only account.
- **EOD auto-fill from Mochi**: when the signed-in setter matches a Mochi member by email (Aalian + Ameer are matched now), their DMs-out and sets auto-fill any still-zero EOD fields once ("auto-filled" note shown); "use" re-syncs on demand. Fixed messages_by_member mapping — Mochi returns `name`/`messages_sent`, not `member_name`/`outbound`.
- **NumField** now `type="text" inputMode="numeric"` with digit/leading-zero stripping — `type="number"` caused the "030"-style caret jams. Verified by scripted typing/backspace.
- **"EOD due" chip** used UTC today while the form used business-timezone today — post-midnight GMT+3 the two disagreed and the chip returned on refresh. Both use `todayBiz()` now.
- **Team page role chips**: closer/coach/founder/student had a muted "selected" color identical to unselected — toggles looked like no-ops. Every role now has a distinct on-state color.

## Addendum 5 — 2026-07-12 late night: goal bar, mentions, finance/Whop, privacy, SOPs

- Team goal bar (Whop-driven progress, admin-editable, whole team sees it), inline @-mentions in chat+alerts (MentionTextarea), EOD auto-fill continuous (manual edits win), Room de-dithered ("Hearth"), humanized due dates, setter activity 24H default, global themed scrollbars, calendar tz combobox, Close cents fix.
- **Action-item privacy** (migration): non-admins see only student items + own (assigned/created); admins/founders see all.
- **cofounder role** (enum + policies, two-step migration — enum values can't be used in the same transaction): Finance opens to Faizan & Abu Bilal via the Team page chip; founder-only surfaces untouched.
- **Whop reconciliation** (`getFinanceRevenue`): Whop charges vs logged deals + paid installments, amount±$1/±3d matching, gap + both unmatched lists on the Finance page. Whop txn window is Mochi's last_90_days — months older than that show logged-only.
- **8 SOPs imported** to Knowledge Hub via Google Docs export endpoint (4 content→Founder Hub, 2 closing, 1 CSM, + Abu Bilal's phone discovery framework cleaned into markdown → setting). All editable in-portal.
- Aalian's "10 booked" mystery: his own test EOD (10s across the board) — data layer working as intended.

## Addendum 6 — 2026-07-12 ~5am: CRM combine, CSM hub, 431 fix

- **/crm combined**: Close | Instagram tabs (Mochi view extracted to `mochi-crm.tsx`, shared with /mochi). Lead drawer now shows Close's own calls (who called, disposition, duration) and Close notes above the portal's internal notes; BOOKED APPOINTMENT badge; "Booked · in CRM now" census on the dashboard activity card (labeled, never summed with EOD sets). Sidebar: one CRM entry (admin+founder).
- **431 root cause**: countLeadNotes passed ~200 lead ids in a GET query string — request line overflowed at real data volume. Moved to POST.
- **CSM hub**: /csm tabs Overview | Workspace | Student Success. Overview = fulfillment dept view for Faizan: success rate vs 95% target bar, students by phase, quiet-students count, weekly output (calls/looms/roleplays/check-ins, recharts). /student-success redirects. Access: admin/csm/coach/founder/cofounder.
- Close opportunity values: cents → dollars, rounded.
- Remaining queued: member performance pages w/ AI read (#19), Sales+Revenue merge (#20), native-controls sweep (#16).
