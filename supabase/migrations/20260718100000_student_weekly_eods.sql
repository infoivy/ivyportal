-- Weekly student accountability for the latest completed Monday-to-Sunday week.
-- Students self-report attendance and reflection; fulfillment staff read it.
create table public.student_weekly_eods (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  week_start date not null,
  group_calls_attended smallint not null,
  implementation text not null,
  biggest_win text,
  biggest_blocker text,
  next_week_commitment text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_weekly_eods_one_per_week unique (student_id, week_start),
  constraint student_weekly_eods_monday_start check (extract(isodow from week_start) = 1),
  constraint student_weekly_eods_calls_range check (group_calls_attended between 0 and 7),
  constraint student_weekly_eods_implementation_required check (length(btrim(implementation)) > 0),
  constraint student_weekly_eods_commitment_required check (length(btrim(next_week_commitment)) > 0)
);

comment on table public.student_weekly_eods is
  'Student-submitted weekly accountability. week_start is Monday; group call attendance is out of seven.';
comment on column public.student_weekly_eods.group_calls_attended is
  'How many of the seven weekly group coaching calls the student attended.';

create index student_weekly_eods_week_idx
  on public.student_weekly_eods (week_start desc, student_id);

alter table public.student_weekly_eods enable row level security;
grant select, insert, update on public.student_weekly_eods to authenticated;
grant all on public.student_weekly_eods to service_role;

create policy "Students read own weekly EODs"
  on public.student_weekly_eods for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_weekly_eods.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "Students insert own weekly EODs"
  on public.student_weekly_eods for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_weekly_eods.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "Students update own weekly EODs"
  on public.student_weekly_eods for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_weekly_eods.student_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_weekly_eods.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "Fulfillment reads weekly student EODs"
  on public.student_weekly_eods for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
  );

create policy "Admins correct weekly student EODs"
  on public.student_weekly_eods for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create function public.protect_student_weekly_eod_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.student_id is distinct from old.student_id
    or new.week_start is distinct from old.week_start then
    raise exception 'student_weekly_eods identity fields are immutable';
  end if;

  new.submitted_at := old.submitted_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke all on function public.protect_student_weekly_eod_history() from public;

create trigger protect_student_weekly_eod_history
  before update on public.student_weekly_eods
  for each row execute function public.protect_student_weekly_eod_history();

create trigger set_student_weekly_eods_updated_at
  before update on public.student_weekly_eods
  for each row execute function public.set_updated_at();

-- Daily student EODs are operational history. Keep legitimate metric
-- corrections, but prevent deletion, reassignment, and date rewriting.
drop policy if exists "Student delete own eods" on public.student_eods;
drop policy if exists "Student update own eods" on public.student_eods;
drop policy if exists "Admins/coaches manage student eods" on public.student_eods;
revoke delete on table public.student_eods from authenticated;

create policy "Student update own eods"
  on public.student_eods for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_eods.student_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_eods.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "Admins/coaches insert student eods"
  on public.student_eods for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
  );

create policy "Admins/coaches update student eods"
  on public.student_eods for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
  );

create function public.protect_student_eod_history_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.student_id is distinct from old.student_id
    or new.report_date is distinct from old.report_date
    or new.created_at is distinct from old.created_at then
    raise exception 'student_eods identity fields are immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_student_eod_history_identity() from public;

create trigger protect_student_eod_history_identity
  before update on public.student_eods
  for each row execute function public.protect_student_eod_history_identity();
