-- Team-visible EOD activity: every team role can see the whole team's
-- activity numbers (dials, DMs, convos, sets, shows) — but never the money
-- columns (cash_collected, deferred_cash, deposits), which stay behind the
-- admin/closer-only RLS on the base table.
--
-- The view runs with owner rights (security_invoker = off), bypassing the
-- base table's RLS; the WHERE clause re-gates it to signed-in team members.
create view public.eods_activity
with (security_barrier = true, security_invoker = off) as
select
  id, user_id, report_date,
  dials, leads_contacted, dms_sent, convos_started,
  calls_booked, calls_scheduled, shows, no_shows, closes,
  created_at
from public.eods
where
  has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder')
  or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
  or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm');

grant select on public.eods_activity to authenticated;
