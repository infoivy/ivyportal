-- Team chat becomes an org setting (founder-directed 2026-08-18).
--
-- Ivy does not use the channel, so it ships OFF and the org's owner turns it
-- on if their team wants it. Default false rather than true: a surface nobody
-- asked for is worse than a surface behind a switch.
--
-- The write is already covered by `orgs_admin_update` (migration
-- 20260818040000): owner, admin or founder of that org only.

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS team_chat_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orgs.team_chat_enabled IS
  'When true the app shows the team channel. Off by default.';
