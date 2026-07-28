-- Canonical analytics contract for operational Home and Performance.
-- Keep the existing eods_activity view unchanged because showcase/demo tools
-- depend on it. This view is intentionally real-only and exposes no money or
-- narrative fields from the base EOD table.
create or replace view public.eods_activity_real
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

comment on view public.eods_activity_real is
  'Real-only, money-free EOD activity for authenticated Ivy staff analytics.';

grant select on public.eods_activity_real to authenticated;
