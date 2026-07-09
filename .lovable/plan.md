
# Phases 2 & 3 — Build Plan

Four placeholder routes get replaced with real features, one stage at a time. Each stage ends in a working, shippable module so nothing sits half-done.

## Stage A — Team Calendar (Google Calendar, per-user)

Each closer connects their **own** Google Calendar. Setters see a unified view before booking a call.

- Per-user Google OAuth (not the workspace connector — that would only show *one* person's calendar). Scope: `https://www.googleapis.com/auth/calendar.readonly`.
- New table `calendar_connections` (user_id, google refresh token, calendar_id, connected_at). RLS: user manages own row, admins/closers read team status.
- "Connect Google Calendar" button on the Calendar page for closers/admins.
- Unified week + day view: all closers' events on one grid, color-coded by closer, filter by closer.
- Tooltip on each event shows title, time, closer.
- Server function refreshes tokens and fetches events (cached 60s).

Prereq: user creates a Google Cloud OAuth client and pastes Client ID + Secret. I'll walk through that and request the secrets when this stage starts.

## Stage B — Training Videos

Team library for training content Abdulrahman uploads.

- Lovable Cloud storage bucket `training` (private, signed URLs).
- Tables: `training_categories`, `training_videos` (title, description, category, video_path, thumbnail_path, duration, uploaded_by, published), `training_progress` (user_id, video_id, seconds_watched, completed_at).
- Admin: upload form, category manager, publish/unpublish.
- Everyone: browse by category, video player, resume where you left off, "Completed" checkmark.
- Simple assignments (Phase 2.5, optional): mark a video required for a role.

## Stage C — Analytics

Deeper cuts than the dashboard cards.

- `/analytics` page with:
  - Full-funnel: DMs → Convos → Booked → Shows → Closes (from EODs; Closes filled by Stage D).
  - Per-setter breakdown table (sortable), sparklines per row.
  - Week-over-week + month-over-month deltas.
  - Range picker (7/30/90/custom), CSV export.
  - Individual view: pick a setter, see their trend + goal pace.
- All queries live in one `analytics.functions.ts` server module for reuse.

## Stage D — Close CRM

Close isn't a native connector, so we go through Close's REST API.

- Admin settings tab: paste Close API key (stored as `CLOSE_API_KEY` secret, admin-only).
- Server functions call `api.close.com/api/v1/` with the key.
- `/crm` page (admin/closer):
  - Pipeline: leads by status, opportunity value.
  - Recent activity feed (calls, emails, notes from Close).
  - Search leads by name/email.
- Close data enriches Analytics: real "Closes" and revenue numbers replace the EOD-only estimates.
- Optional write-back: from an EOD, log a call outcome to the matching Close opportunity.

## Technical notes

- File layout adds:
  - `src/routes/_authenticated.calendar.tsx` (real UI), `src/routes/api/public/google-oauth-callback.ts`
  - `src/routes/_authenticated.training.tsx`, `src/routes/_authenticated.training.$videoId.tsx`, `src/routes/_authenticated.training.admin.tsx`
  - `src/routes/_authenticated.analytics.tsx` (real)
  - `src/routes/_authenticated.crm.tsx` (real), `src/routes/_authenticated.settings.integrations.tsx`
- Migrations: `calendar_connections`, `training_categories`, `training_videos`, `training_progress`, storage bucket `training`. All with GRANTs + RLS per Lovable Cloud rules.
- Secrets requested at the right stage: Google OAuth Client ID + Secret (Stage A), `CLOSE_API_KEY` (Stage D).
- UI matches the current creator-dashboard aesthetic (gradient hero, colorful KPI chips, area charts).

## Order & shipping

Build **A → B → C → D**, one stage per turn. After each stage you can use it, then say "next" and I'll start the following one. If you'd rather I ship all four back-to-back without stopping, tell me and I'll chain them.

Approve to start Stage A (Calendar).
