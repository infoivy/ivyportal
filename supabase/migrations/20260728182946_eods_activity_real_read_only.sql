-- Supabase default privileges can grant every view privilege to browser roles.
-- This analytics view is a read-only staff surface: anonymous access and all
-- browser-side mutation privileges must be removed explicitly.
revoke all on table public.eods_activity_real from public, anon, authenticated;
grant select on table public.eods_activity_real to authenticated;
