# Remaining Work — Execution Plan

Scope is large (7 sections, ~30 sub-items). I'll ship in the order below so each turn ends with something usable. I'll pause after **each numbered section** for you to sanity-check the preview before I move on. Nothing touches EOD, or anything already working.

---

## 1. Founder Hub — Content Engine (biggest, done first)

Turn 1a — Schema + capture upgrades
- Migration: extend `content_items` with `script` (md), `hook`, `raw_video_url`, `edited_reel_url`, `source`, `duration_sec`, `platforms text[]`, `reedit_flag bool`. Add `recorded_at`, `edited_at`.
- Add enum values to `content_items.status`: `scripted`, `approved`, `recorded`, `edited`, `scheduled`, `posted`.
- New table `content_hooks` (text, placeholders, example, category, funnel_stage, favorite, times_used).
- Extend `content_ideas` (capture inbox) with `trigger` enum (client_conv / own_realization / result / repeated_question), `explanation`, `funnel_guess`.
- New `founder_settings` singleton (recording_day int default 4=Thu, top_setter_bonus_pct, weekly_cash_bonus_threshold, weekly_cash_bonus_pct).

Turn 1b — Two-week planning horizon
- `ensureWeekProvisioned` extended to provision current + next week (14 slots, 8 TOF Mon–Thu × 2 + 6 MOF Fri–Sun × 2).
- Weekly plan grid renders 2 weeks side-by-side (stacked on mobile) with week headers.

Turn 1c — Card editor
- Full-fat content card modal: Title, Format (shared vocab), Hook (with "Pick from library" button), Script (markdown editor), Status pipeline dropdown, Scheduled date, Raw/Edited URLs, Source, Duration, Platforms multiselect, Re-edit flag.
- Kanban columns updated to full pipeline. Add Table view (sortable).

Turn 1d — Recording Day view + Focus Mode
- New tab "Recording Day" in Founder Hub: checklist of every reel in `scripted`/`approved` for next 14 days, "Ready: X of 14" counter (ready = idea+hook+format+script). Mark Recorded checkbox → status advance.
- Focus Mode: full-screen one-at-a-time reader (big text, next/prev).

Turn 1e — Hook Library tab
- New tab. Search, filter TOF/MOF, category, favorites. Copy button, usage counter. Bulk paste importer (splits on blank lines). "Pick hook" button on any card opens as a picker.

Turn 1f — Capture inbox + monthly reset
- Capture form gets 4 trigger chips + "how I'd explain" + TOF/MOF guess. Small reminder card listing the 4 triggers.
- "Harvest selected → ideation pad" action.
- Monthly Reset wizard: archives (never deletes) last month's weeks, carries unposted forward, prompts to log IG analytics + review SOP staleness.
- Header copy → "Plan, script, record, post."

---

## 2. IG Analytics — real data

- Migration: `ig_monthly_snapshots` (followers, new_followers, views, reach, profile_visits, interactions, dms, link_clicks, posts, month date). `ig_top_reels` (topic, pillar, views, saves, shares, comments, avg_watch_time, follows, linked_content_item_id, month).
- Delete hardcoded Oct–Jan data + March mock.
- Month picker + "Log this month" form. Growth trend derives from snapshots.
- Founder Hub nudge card when current month unlogged.
- When a content_item flips to `posted`, prompt for avg watch time + views + follows → run Hook Diagnostic per SOP rules → save diagnosis on the card.
- "Last updated: <month>" badge.

---

## 3. Revenue — commission fix

- Migration: extend `commission_rates` — drop `setter_pif_bonus`, add `top_setter_bonus_pct` (default 1), `weekly_cash_bonus_threshold` (7500), `weekly_cash_bonus_pct` (1). Add `commission_periods` for top-setter 14-day tracking, or compute on the fly from EOD/deals.
- Update `src/lib/revenue.ts` `setterCommissionForDeal`: base + (top-setter-of-period? +bonus) + (that setter's week ≥ threshold? +bonus). Show which bonus fired.
- Move rates editor to Admin → Commission Settings; Revenue shows compact "View rates" link.
- Trend chart: Daily / Weekly / Monthly toggle.
- Fix or remove the two "Loading…" leaderboards on Revenue.

---

## 4. Dashboard de-bloat

- Merge 3 leaderboards into one card with Cash / Booked toggle.
- Setter Start-Here checklist: dismissible + hidden for admin/founder.
- Remove "My Day — Admin view" placeholder.

---

## 5. Knowledge Hub embeds

- Fill full body content for: Objection Handling Part 1, Part 2, GA Appointment Setting — Full Roadmap. Google Doc becomes an "Original source" footer link (already implemented — I'll just fill the bodies).
- Doc reader: TOC sidebar already exists; verify it renders for these three docs.

---

## 6. Small cleanups

- Students table: swap inline dropdowns for shadcn Select (compact). Hide Grade column.
- Team page: render only assigned role chips; move IDs to a detail drawer; add Setter Type field (Phone / DM).
- CRM empty state fix.
- Closer Resources: verify Wise USD/EUR, Revolut, YO placeholder render with copy buttons; enforce closer/admin role gate.

---

## Technical notes

- All new tables get `GRANT`s + RLS scoped to founder/admin (or closer/admin where applicable).
- Migrations submitted for approval one at a time in order (1a → 2 → 3).
- No new top-level nav — everything lives as tabs on Founder Hub, Admin, existing pages.
- Never delete user data — archival flags only.
- Every new UI element mobile-tested.

---

**Confirming before I start:** OK to proceed section by section starting with **1a (Founder Hub schema migration)**? If you want a different order (e.g. Revenue first because it affects payouts today), say so.
