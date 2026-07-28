-- Team members carry their own timezone (founder-requested 2026-07-28):
-- staff submit phone + timezone on Profile, and the Team page shows each
-- member's current local time. Students keep students.timezone.
alter table public.profiles add column timezone text;
