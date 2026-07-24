-- Founder-directed 2026-07-25:
--  1. The weekly EOD files itself just before Sunday midnight in each
--     student's OWN timezone, built from their live attendance ticks — a
--     missed Sunday no longer means a missing record.
--  2. Students never delete EODs (daily or weekly) — they adjust. Deleting a
--     bogus row is a staff action (admin/coach/CSM).

-- ── auto-submit ──────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

create or replace function public.auto_submit_student_weekly_eods()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
  r record;
begin
  for r in
    select
      s.id as student_id,
      (now() at time zone s.timezone)::date as local_date
    from public.students s
    where s.timezone is not null
      and s.timezone in (select name from pg_timezone_names)
      and s.onboarding_completed_at is not null
      and s.status = 'active'
      and s.eod_exempt is not true
      and s.phase not in ('offer_won', 'testimonial', 'graduated')
      -- Sunday 23:45+ in the student's own local time
      and extract(isodow from (now() at time zone s.timezone)) = 7
      and (now() at time zone s.timezone)::time >= time '23:45'
  loop
    insert into public.student_weekly_eods (
      student_id, week_start, calls_attended, group_calls_attended,
      one_on_one_calls, implementation, next_week_commitment
    )
    select
      r.student_id,
      r.local_date - 6,  -- Sunday → that week's Monday
      coalesce((
        select jsonb_agg(jsonb_build_object('day', a.day, 'name', a.name) order by a.ticked_at)
        from public.student_call_attendance a
        where a.student_id = r.student_id and a.week_start = r.local_date - 6
      ), '[]'::jsonb),
      coalesce((
        select count(*) from public.student_call_attendance a
        where a.student_id = r.student_id and a.week_start = r.local_date - 6
      ), 0),
      null,
      'Auto-submitted at week end from your attendance ticks.',
      'Not set · auto-submitted at week end.'
    on conflict (student_id, week_start) do nothing;
    if found then inserted := inserted + 1; end if;
  end loop;
  return inserted;
end;
$$;

revoke all on function public.auto_submit_student_weekly_eods() from public, anon, authenticated;

-- Every 5 minutes; the 23:45–24:00 local window guarantees at least one hit
-- per student per Sunday, and the unique (student_id, week_start) key makes
-- repeats no-ops.
select cron.schedule(
  'student-weekly-eod-autosubmit',
  '*/5 * * * *',
  $$select public.auto_submit_student_weekly_eods()$$
);

-- ── staff-only EOD deletion ──────────────────────────────────────────────────
-- Daily: delete was revoked outright on 2026-07-18; restore the grant and
-- scope it to staff. Students still have no DELETE policy → still blocked.
grant delete on public.student_eods to authenticated;
create policy "Staff delete student eods"
  on public.student_eods for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
    or public.has_role(auth.uid(), 'csm')
  );

-- Weekly: same rule.
grant delete on public.student_weekly_eods to authenticated;
create policy "Staff delete weekly student eods"
  on public.student_weekly_eods for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
    or public.has_role(auth.uid(), 'csm')
  );
