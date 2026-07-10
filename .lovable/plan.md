Guiding principle: overzichtelijk — every card answers one clear question, plain language, consistent date format ("Mon, Jul 10"), consistent range picker.

## 1. EOD Reports — full redesign

Rebuild `/eods` with a 4-tab layout. Non-admins default to "My EOD"; admin/founder default to "Team Compliance".

- **Tab 1 — My EOD**: today's submission form + my current streak + last 7 days as ✓/✗ chips ("Mon 6 ✓ · Tue 7 ✓ · Wed 8 ✗ …"). Nothing else.
- **Tab 2 — Team Compliance**: submission matrix.
  - Rows grouped by role: Setters, Closers, CSM, Coaches.
  - Columns = last 7 / 14 / 30 days (toggle). Headers "Mon 6" style, never "7/6".
  - Cells: green ✓ submitted, red ✗ missed, gray "—" not required. Not-required rule: **Sundays are always gray**; Mon–Sat is required per role. (No per-person schedule this round.)
  - Row-end summary: current streak + compliance % over the visible range.
  - Row header shows name + role badge.
- **Tab 3 — Graphs**: three charts sharing one 7D/30D/90D range picker.
  - (a) Daily submissions vs expected (stacked bar).
  - (b) Funnel metrics over time — line, series toggle: DMs / convos / booked / shows; scope toggle: team total vs per-setter.
  - (c) Weekly compliance % trend.
- **Tab 4 — Team Feed**: keep existing entries but re-render as clean cards — name, "Mon, Jul 10", 4–5 labeled key numbers, one-line note.

Preset views (buttons above Team Compliance + Graphs):

- **Sales view** (Abu Bilal): setters + closers only; funnel = DMs, convos, booked, shows, cash.
- **Fulfillment view** (Faizan): CSM + coaches only; funnel = CSM EODs, 1:1s done, action items closed, student check-ins.

Global copy pass on the page: every count gets a label ("Reports submitted: 7 of 7 expected today"), never a bare "7/7". No numeric month/day pairs anywhere.

## 2. Knowledge Hub

- Remove "Recently updated" strip from `/knowledge` index.
- Doc reader upgrades: proper markdown (headings, tables, checklists — already using MarkdownView, extend where needed), auto-generated table-of-contents sidebar for docs > ~600 chars, in-doc search (Cmd/Ctrl+F style filter over headings + body).
- Where a doc's body is empty or only holds the summary, show the same "Content missing — click Edit to paste it in" state as Founder SOPs.
- Google Doc link: keep as small "Original source" footnote at the bottom, never as primary content.
- **Google Docs auto-pull**: for docs with a Google Doc URL in `external_links`, add an admin "Pull from Google Doc" button on the edit view that fetches via the Google Docs connector and converts JSON → markdown (headings, bold/italic, lists, tables). Uses `standard_connectors--connect google_docs`; renders inline in the editor for review before saving. Requires the user to connect Google Docs once.

## 3. Closer Resources — payment links

Build `/closer-resources` payment links section (role gate: admin + closer). One page, category accordions:

- **Whop (main gateway)** — 13 rows, one per bracket ($100 → $2500), labels "Whop $X", each row: label, URL, "Copy link" button, "Copy message" button.
- **Wise USD** — bank-transfer details block (name, routing, account, address, SWIFT). Each field has its own copy button + a "Copy all" button that copies the full formatted message.
- **Wise EUR** — IBAN, SWIFT, address, name; same copy pattern.
- **Revolut** — payment link + EUR IBAN/BIC/bank block; same copy pattern.
- **YO (UAE bank)** — category shown with a "Details coming soon" empty state and an admin-only "Edit" button.

"Copy message" produces a customer-ready block, e.g. for Whop:

```text
Payment link for $500:
https://whop.com/checkout/plan_sWXNMK93z07Ws

Let me know once it goes through.
```

Data is seeded via a migration and lives in a `payment_links` table (already exists — verify shape and reuse or extend). RLS: `SELECT` for admin + closer only.

## 4. Revenue

- **Trend chart**: add Daily / Weekly / Monthly toggle; existing monthly view becomes the default.
- **Setter commission model** — historical records untouched; new logic applies from now on.
  - Remove all "setter PIF bonus" logic and UI.
  - Add two bonus mechanics on the setter row:
    - **Top-setter bonus**: every 14 days, the setter with the highest **cash collected** (their share of deals from bookings they made) gets +1% for the next 14-day period. Show badge: "Top setter Jul 1–14 · +1%".
    - **Weekly cash threshold**: if a setter's weekly cash collected ≥ **$7,500** (configurable), +1% for that week. Show badge: "Week ≥ $7.5k · +1%".
  - Both thresholds and bonus % editable in Admin Settings (see below).
- **Commission settings**: move the "Commission rates" card off `/revenue` and into **Admin → Settings → Commission**. Each rate line gets a plain-language sentence ("Closers earn X% of cash collected on a new close."). Revenue page keeps a small "Rates" link for admins that deep-links there.

## 5. Founder Hub (biggest section)

### 5a. Rename
Rename **Founder Space → Founder Hub** everywhere: sidebar label, page title, `<h1>`, breadcrumbs, buttons, meta tags. Route path stays `/founder` (no need to break URLs).

### 5b. Calendar labels
Verify the calendar view uses the SOP-mandated pattern:
- **Mon–Thu → TOF (4 slots)**, labels "TOF · 1 of 4" through "TOF · 4 of 4".
- **Fri–Sun → MOF (3 slots)**, labels "MOF · 1 of 3" through "MOF · 3 of 3".
- Weekly plan, `/calendar` page, and SOP references must all agree.

### 5c. Two-week batch recording — new model
Switch the content plan model from 1-week to **explicit 2-week cycles**.

Data changes (new migration):
- Add `content_cycle_start` (date) to `content_week_ideas`, `content_week_plans`, and content items — Monday of the cycle's first week.
- Add a `content_settings` row per user: `recording_day` (default 'thursday'), `platforms_default` (jsonb).
- Add columns to content items: `script` (text/markdown), `raw_video_url`, `edited_reel_url`, `source`, `duration_seconds` (int), `platforms` (text[]), `re_edit_requested` (bool).
- Expand `status` enum pipeline: **Idea → Scripted → Approved → Recorded → Edited → Scheduled → Posted**. Add `re_edit_requested` flag as an orthogonal boolean.
- Cycle has 14 slots total: 8 TOF (2× Mon–Thu) + 6 MOF (2× Fri–Sun).

Founder Hub tabs become:

1. **Cycle Plan** (renamed from "Weekly Plan"): shows current + next week side-by-side with 14 slots. Each slot row has idea → hook → format → script inline.
2. **Recording Day**: prominent tab. Clean checklist of every reel to record for the next 2 weeks (only items that are Scripted or Approved). Each card shows title/idea, full hook line, script preview, format, target duration, platforms, scheduled post date, "Recorded" checkbox.
   - **Focus mode**: full-screen one-script-at-a-time viewer with next/prev + "Mark recorded".
   - **Ready-to-record counter**: "Ready to record: 9 of 14" at the top (a slot is ready when idea + hook + format + script are all present).
3. **Content Tracker** (renamed from earlier "Content" tab): three views over the same items.
   - **Kanban**: columns = new status pipeline, with a re-edit badge lane visible on Edited.
   - **List**: existing list.
   - **Table** (new): sortable columns matching the Notion tracker — Title, Format, Status, Date, Raw Video, Edited Reel, Source, Duration, Platforms.
4. **SOPs & Playbooks**: unchanged.
5. **Ideation Pad**: unchanged (creative types already updated to the 7 formats).
6. **Monthly Reset**: wizard regenerates next month's two-week cycles + reminds to redo Content Brainstorm per SOP.

Card readiness rule: content card status can advance to "Recorded" only when idea + hook + format + script are all filled. Show a subtle warning icon on incomplete cards.

## 6. Global data & clarity pass

- Every dashboard number gets a **label + time range** ("Cash collected · last 30 days: $18,240"). Audit `/dashboard`, `/analytics`, `/revenue`, `/founder`, `/csm`, `/instagram`.
- Standardize a single `<RangePicker>` component (already exists) across all chart surfaces: 7D / 30D / 90D for daily-based data, Daily / Weekly / Monthly for trend charts. Replace ad-hoc pickers.
- Add "?" tooltip helpers on any non-obvious metric (compliance %, funnel conversion, commission bonus). Plain language, one sentence.
- Empty states: every empty list/card gets a one-line "This is where X lives" + the primary action button.
- Kill low-value cards that don't answer a clear question (agent to enumerate before deletion for approval).
- App-wide date format: `"Mon, Jul 10"` (or `"Jul 10"` in tight cells). No `7/10` anywhere.

## 7. Guardrails (applied)

- Historical EOD / revenue / installment rows: read-only, untouched. Commission bonus logic applies forward only.
- No new top-level nav; only new **tabs** within existing pages.
- Founder Hub: admin/founder only. Payment details: admin/closer only.
- Mobile-usable: cycle plan and Kanban scroll horizontally on phone; tables use responsive grid patterns.

---

## Technical notes

- **New tables/migrations**
  - `payment_links_seed` migration for the Whop/Wise/Revolut/YO data (or seed into existing `payment_links` — will confirm shape first). RLS `SELECT` scoped to admin + closer.
  - `content_settings` table: `user_id`, `recording_day text default 'thursday'`, `platforms_default jsonb`. RLS by owner.
  - `commission_settings` table (or JSON blob on an existing settings table): `role`, `rate_pct`, `label`, `description`, plus rows for `top_setter_bonus_days` (14), `top_setter_bonus_pct` (1), `weekly_cash_threshold` (7500), `weekly_cash_bonus_pct` (1). Admin-only RLS.
  - Alter `content_items`: add `script`, `raw_video_url`, `edited_reel_url`, `source`, `duration_seconds`, `platforms`, `re_edit_requested`, `cycle_start`. Extend status enum (`scripted`, `approved`, `recorded`, `edited`, `scheduled`, `posted`).
  - Alter `content_week_ideas` / `content_week_plans`: add `cycle_start`; keep `week_start` for backwards compat; provisioning writes both.

- **Google Docs connector**: use `standard_connectors--connect google_docs` (deferred), read via `https://connector-gateway.lovable.dev/google_docs/v1/documents/{id}`, convert JSON body → markdown (headings, bold/italic/underline, bullet/numbered lists, tables). Server function `pullGoogleDoc({ docId })` gated by admin role.

- **EOD compliance matrix**: computed via a single server function that returns `{ userId, role, days: [{ date, status: 'submitted'|'missed'|'not_required' }] }[]`. Sunday → `not_required`. Streak calc walks backwards from today skipping `not_required`.

- **Commission recompute**: pure computation server-side over `deals` + `commission_settings`, keyed by 14-day windows anchored to a configurable start date. No writes to historical rows.

- **Rename Founder Space → Founder Hub**: single string sweep across `src/routes/_authenticated.founder.tsx`, sidebar, breadcrumbs, meta, `founder-sops.tsx`, `weekly-plan.tsx`.

- **Range picker**: extract `<RangePicker mode="days"|"granularity">` from existing `src/components/range-picker.tsx`; audit consumers.

---

## Suggested build order (to keep review chunks small)

1. **Guardrails + rename**: Founder Space → Founder Hub sweep (safe, no data risk).
2. **EOD redesign** (tabs, matrix, sales/fulfillment views, graphs).
3. **Closer Resources payment links** (migration + UI).
4. **Knowledge Hub** (embed body pattern, TOC, in-doc search, Google Docs pull).
5. **Founder Hub 2-week cycle** (schema migration → Cycle Plan → Recording Day → Content Tracker table/statuses).
6. **Revenue + Commission settings move**.
7. **Global clarity pass** (range picker unification, tooltips, empty states, date-format sweep).

I'll return after each chunk for a checkpoint rather than shipping all seven at once.
