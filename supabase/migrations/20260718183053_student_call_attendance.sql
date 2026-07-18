-- Tick-as-you-go group-call attendance (founder-directed 2026-07-18):
-- students tick each call's tile right after attending, any day of the week,
-- from any device; the Sunday weekly EOD pre-fills from these rows and
-- snapshots them into student_weekly_eods.calls_attended on submit.
create table public.student_call_attendance (
  student_id uuid not null references public.students(id) on delete cascade,
  week_start date not null,
  day text not null,
  name text not null,
  ticked_at timestamptz not null default now(),
  primary key (student_id, week_start, day),
  constraint student_call_attendance_monday_start check (extract(isodow from week_start) = 1)
);

comment on table public.student_call_attendance is
  'Live per-call attendance ticks for the Monday-start week. The weekly EOD submit snapshots these into student_weekly_eods.calls_attended; these rows stay as the in-week log.';

alter table public.student_call_attendance enable row level security;
grant select, insert, delete on public.student_call_attendance to authenticated;
grant all on public.student_call_attendance to service_role;

create policy "Students manage own call attendance"
  on public.student_call_attendance for all to authenticated
  using (
    exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  );

create policy "Fulfillment reads call attendance"
  on public.student_call_attendance for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
  );

create policy "Admins correct call attendance"
  on public.student_call_attendance for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- The real weekly call schedule from Skool (names confirmed by founder;
-- day slots per the Skool calendar).
update public.org_settings set group_call_schedule = '[
  {"day": "Mon", "name": "🧠 Off Call Discipline w/ Abu Bilal"},
  {"day": "Tue", "name": "💼 Role Finding Masterclass w/ Faizan"},
  {"day": "Wed", "name": "📞 Roleplays w/ Abdulrahman"},
  {"day": "Thu", "name": "📝 Script Breakdown w/ Faizan"},
  {"day": "Fri", "name": "⚔️ Setting Mastery w/ Abdulrahman"},
  {"day": "Sat", "name": "🎬 Call Review Thursdays w/ Abu Bilal"},
  {"day": "Sun", "name": "📞 Roleplays w/ Abdulrahman"}
]'::jsonb;
