-- Operational dashboards must never mix demo EODs into real team metrics.
-- Demo records remain available from the base eods table to explicit demo tools.
create or replace view public.eods_activity
with (security_barrier = true, security_invoker = off) as
select
  id, user_id, report_date,
  dials, leads_contacted, dms_sent, convos_started,
  calls_booked, calls_scheduled, shows, no_shows, closes,
  created_at
from public.eods
where
  is_demo is not true
  and (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder')
    or has_role(auth.uid(), 'cofounder')
    or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
    or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );

grant select on public.eods_activity to authenticated;
