-- The dashboard reads eods_activity while Sales/EODs read the raw table.
-- The view's is_demo exclusion made the founder's KPI tiles sit near zero
-- next to fully-populated pages while the showcase dataset is seeded
-- (founder-reported "glitching" 2026-07-22). Demo rows are deliberate and
-- founder-visible; npm run demo:remove deletes them outright, so the filter
-- bought nothing an empty table doesn't. Role gate unchanged.
create or replace view public.eods_activity
with (security_barrier = true, security_invoker = off) as
select
  id, user_id, report_date,
  dials, leads_contacted, dms_sent, convos_started,
  calls_booked, calls_scheduled, shows, no_shows, closes,
  created_at
from public.eods
where
  has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder')
  or has_role(auth.uid(), 'cofounder')
  or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
  or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm');
