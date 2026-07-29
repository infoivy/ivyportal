-- Native per-setter tracking inside Calendar.
--
-- Existing submitted EODs remain the daily activity source. This migration
-- adds only the missing per-set lifecycle and dated follow-up history.

alter table public.set_reminders
  add column if not exists lead_channel text not null default 'unknown',
  add column if not exists qualification_status text not null default 'unknown',
  add column if not exists attendance_status text not null default 'pending',
  add column if not exists sales_outcome text not null default 'pending',
  add column if not exists outcome_recorded_at timestamptz,
  add column if not exists calendar_sync_status text not null default 'synced',
  add column if not exists calendar_sync_error text,
  add column if not exists calendar_sync_token uuid,
  add column if not exists calendar_sync_updated_at timestamptz not null default now(),
  add column if not exists gcal_event_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists transition_actor_id uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_lead_channel_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_lead_channel_check
      check (lead_channel in ('unknown', 'inbound', 'outbound', 'referral', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_qualification_status_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_qualification_status_check
      check (qualification_status in ('unknown', 'qualified', 'unqualified'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_attendance_status_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_attendance_status_check
      check (attendance_status in ('pending', 'showed', 'no_show', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_sales_outcome_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_sales_outcome_check
      check (sales_outcome in ('pending', 'follow_up', 'closed', 'lost'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_calendar_sync_status_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_calendar_sync_status_check
      check (calendar_sync_status in ('synced', 'pending', 'error', 'not_connected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'set_reminders_calendar_sync_error_length_check'
      and conrelid = 'public.set_reminders'::regclass
  ) then
    alter table public.set_reminders
      add constraint set_reminders_calendar_sync_error_length_check
      check (calendar_sync_error is null or char_length(calendar_sync_error) <= 500);
  end if;
end
$$;

update public.set_reminders
set attendance_status = 'cancelled', updated_at = now()
where status = 'cancelled' and attendance_status = 'pending';

update public.set_reminders
set gcal_event_owner_id = owner_id
where gcal_event_id is not null
  and gcal_event_owner_id is null
  and owner_id is not null;

drop trigger if exists set_reminders_set_updated_at on public.set_reminders;
create trigger set_reminders_set_updated_at
before update on public.set_reminders
for each row execute function public.set_updated_at();

create table if not exists public.set_follow_ups (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.set_reminders(id) on delete restrict,
  due_at timestamptz not null,
  channel text not null default 'dm'
    check (channel in ('dm', 'phone', 'email', 'other')),
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  note text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 4000)
);

create index if not exists set_follow_ups_due_idx
  on public.set_follow_ups(status, due_at);
create index if not exists set_follow_ups_set_idx
  on public.set_follow_ups(set_id, created_at desc);
create unique index if not exists set_follow_ups_one_open_per_set_idx
  on public.set_follow_ups(set_id) where status = 'open';

create table if not exists public.set_reminder_events (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.set_reminders(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in (
      'created', 'assignment_changed', 'status_changed',
      'confirmation_changed', 'reminder_changed', 'channel_changed',
      'qualification_changed', 'attendance_changed', 'outcome_changed',
      'note_changed', 'calendar_sync_changed',
      'follow_up_created', 'follow_up_changed', 'set_updated'
    )),
  from_value jsonb,
  to_value jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists set_reminder_events_set_idx
  on public.set_reminder_events(set_id, created_at desc);
create index if not exists set_reminder_events_actor_idx
  on public.set_reminder_events(actor_id, created_at desc)
  where actor_id is not null;

create or replace function public.protect_set_reminder_event_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role demo teardown is the only deletion exception. Browser roles
  -- have neither grants nor policies for event mutation, and real history is
  -- immutable even to service maintenance.
  if tg_op = 'DELETE'
    and auth.uid() is null
    and exists (
      select 1
      from public.set_reminders sr
      join public.profiles p on p.id = sr.owner_id
      where sr.id = old.set_id
        and p.is_demo is true
    ) then
    return old;
  end if;

  raise exception 'Set reminder audit history is immutable';
end;
$$;

revoke execute on function public.protect_set_reminder_event_history() from public, anon, authenticated;
grant execute on function public.protect_set_reminder_event_history() to service_role;

drop trigger if exists protect_set_reminder_event_history on public.set_reminder_events;
create trigger protect_set_reminder_event_history
before update or delete on public.set_reminder_events
for each row execute function public.protect_set_reminder_event_history();

create or replace function public.protect_set_follow_up_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.set_id is distinct from old.set_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Set follow-up identity and creation fields are immutable';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by := coalesce(new.completed_by, auth.uid());
  elsif new.status <> 'completed' then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.protect_set_follow_up_identity() from public, anon, authenticated;
grant execute on function public.protect_set_follow_up_identity() to service_role;

drop trigger if exists protect_set_follow_up_identity on public.set_follow_ups;
create trigger protect_set_follow_up_identity
before update on public.set_follow_ups
for each row execute function public.protect_set_follow_up_identity();

create or replace function public.protect_set_reminder_internal_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.owner_id is distinct from old.owner_id
    or new.status is distinct from old.status
    or new.event_start is distinct from old.event_start
    or new.duration_min is distinct from old.duration_min
    or new.gcal_event_id is distinct from old.gcal_event_id
    or new.gcal_event_owner_id is distinct from old.gcal_event_owner_id
    or new.gcal_html_link is distinct from old.gcal_html_link
    or new.calendar_sync_status is distinct from old.calendar_sync_status
    or new.calendar_sync_error is distinct from old.calendar_sync_error
    or new.calendar_sync_token is distinct from old.calendar_sync_token
    or new.calendar_sync_updated_at is distinct from old.calendar_sync_updated_at
    or new.transition_actor_id is distinct from old.transition_actor_id
  ) then
    raise exception 'Set ownership, scheduling, and Calendar sync fields are server-controlled';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_set_reminder_internal_fields() from public, anon, authenticated;
grant execute on function public.protect_set_reminder_internal_fields() to service_role;

-- PostgreSQL runs same-timing triggers alphabetically. The aaa prefix ensures
-- direct authenticated writes are rejected before the audit trigger clears the
-- trusted transition_actor_id used by service-role operations.
drop trigger if exists aaa_protect_set_reminder_internal_fields on public.set_reminders;
create trigger aaa_protect_set_reminder_internal_fields
before update on public.set_reminders
for each row execute function public.protect_set_reminder_internal_fields();

create or replace function public.audit_set_reminder_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
  transition_actor uuid;
  previous_value jsonb;
  next_value jsonb;
begin
  transition_actor := coalesce(auth.uid(), new.transition_actor_id);
  new.transition_actor_id := null;

  if row(old.calendar_sync_status, old.calendar_sync_error)
    is distinct from row(new.calendar_sync_status, new.calendar_sync_error) then
    new.calendar_sync_updated_at := now();
  end if;

  if row(
    old.owner_id, old.status, old.confirmed_at, old.reminder_log, old.notes,
    old.lead_channel, old.qualification_status, old.attendance_status,
    old.sales_outcome, old.outcome_recorded_at, old.calendar_sync_status,
    old.calendar_sync_error
  ) is not distinct from row(
    new.owner_id, new.status, new.confirmed_at, new.reminder_log, new.notes,
    new.lead_channel, new.qualification_status, new.attendance_status,
    new.sales_outcome, new.outcome_recorded_at, new.calendar_sync_status,
    new.calendar_sync_error
  ) then
    return new;
  end if;

  event_name := case
    when old.owner_id is distinct from new.owner_id then 'assignment_changed'
    when old.status is distinct from new.status then 'status_changed'
    when old.confirmed_at is distinct from new.confirmed_at then 'confirmation_changed'
    when old.reminder_log is distinct from new.reminder_log then 'reminder_changed'
    when old.lead_channel is distinct from new.lead_channel then 'channel_changed'
    when old.qualification_status is distinct from new.qualification_status then 'qualification_changed'
    when old.attendance_status is distinct from new.attendance_status then 'attendance_changed'
    when old.sales_outcome is distinct from new.sales_outcome then 'outcome_changed'
    when old.notes is distinct from new.notes then 'note_changed'
    when row(old.calendar_sync_status, old.calendar_sync_error)
      is distinct from row(new.calendar_sync_status, new.calendar_sync_error)
      then 'calendar_sync_changed'
    else 'set_updated'
  end;

  previous_value := jsonb_build_object(
    'owner_id', old.owner_id,
    'status', old.status,
    'confirmed_at', old.confirmed_at,
    'reminder_log', old.reminder_log,
    'lead_channel', old.lead_channel,
    'qualification_status', old.qualification_status,
    'attendance_status', old.attendance_status,
    'sales_outcome', old.sales_outcome,
    'outcome_recorded_at', old.outcome_recorded_at,
    'calendar_sync_status', old.calendar_sync_status,
    'calendar_sync_error', old.calendar_sync_error,
    'notes', old.notes
  );
  next_value := jsonb_build_object(
    'owner_id', new.owner_id,
    'status', new.status,
    'confirmed_at', new.confirmed_at,
    'reminder_log', new.reminder_log,
    'lead_channel', new.lead_channel,
    'qualification_status', new.qualification_status,
    'attendance_status', new.attendance_status,
    'sales_outcome', new.sales_outcome,
    'outcome_recorded_at', new.outcome_recorded_at,
    'calendar_sync_status', new.calendar_sync_status,
    'calendar_sync_error', new.calendar_sync_error,
    'notes', new.notes
  );

  insert into public.set_reminder_events (
    set_id, actor_id, event_type, from_value, to_value
  ) values (
    new.id, transition_actor, event_name, previous_value, next_value
  );

  return new;
end;
$$;

create or replace function public.audit_set_reminder_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.set_reminder_events (
    set_id, actor_id, event_type, from_value, to_value
  ) values (
    new.id,
    auth.uid(),
    'created',
    null,
    jsonb_build_object(
      'owner_id', new.owner_id,
      'status', new.status,
      'confirmed_at', new.confirmed_at,
      'reminder_log', new.reminder_log,
      'lead_channel', new.lead_channel,
      'qualification_status', new.qualification_status,
      'attendance_status', new.attendance_status,
      'sales_outcome', new.sales_outcome,
      'outcome_recorded_at', new.outcome_recorded_at,
      'calendar_sync_status', new.calendar_sync_status,
      'calendar_sync_error', new.calendar_sync_error,
      'notes', new.notes
    )
  );
  return new;
end;
$$;

revoke execute on function public.audit_set_reminder_transition() from public, anon, authenticated;
revoke execute on function public.audit_set_reminder_created() from public, anon, authenticated;
grant execute on function public.audit_set_reminder_transition() to service_role;
grant execute on function public.audit_set_reminder_created() to service_role;

drop trigger if exists audit_set_reminder_transition on public.set_reminders;
create trigger audit_set_reminder_transition
before update on public.set_reminders
for each row execute function public.audit_set_reminder_transition();

drop trigger if exists audit_set_reminder_created on public.set_reminders;
create trigger audit_set_reminder_created
after insert on public.set_reminders
for each row execute function public.audit_set_reminder_created();

create or replace function public.audit_set_follow_up_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_value jsonb;
  next_value jsonb;
  event_name text;
begin
  if tg_op = 'UPDATE' then
    if row(
      old.due_at, old.channel, old.status, old.note,
      old.completed_at, old.completed_by
    ) is not distinct from row(
      new.due_at, new.channel, new.status, new.note,
      new.completed_at, new.completed_by
    ) then
      return new;
    end if;

    event_name := 'follow_up_changed';
    previous_value := jsonb_build_object(
      'due_at', old.due_at,
      'channel', old.channel,
      'status', old.status,
      'note', old.note,
      'completed_at', old.completed_at,
      'completed_by', old.completed_by
    );
  else
    event_name := 'follow_up_created';
    previous_value := null;
  end if;

  next_value := jsonb_build_object(
    'due_at', new.due_at,
    'channel', new.channel,
    'status', new.status,
    'note', new.note,
    'completed_at', new.completed_at,
    'completed_by', new.completed_by
  );

  insert into public.set_reminder_events (
    set_id, actor_id, event_type, from_value, to_value
  ) values (
    new.set_id,
    coalesce(auth.uid(), new.completed_by, new.created_by),
    event_name,
    previous_value,
    next_value
  );

  return new;
end;
$$;

revoke execute on function public.audit_set_follow_up_change() from public, anon, authenticated;
grant execute on function public.audit_set_follow_up_change() to service_role;

drop trigger if exists audit_set_follow_up_change on public.set_follow_ups;
create trigger audit_set_follow_up_change
after insert or update on public.set_follow_ups
for each row execute function public.audit_set_follow_up_change();

-- Security-definer identity check keeps demo exclusion reliable inside RLS even
-- when the caller cannot otherwise read the target profile row.
create or replace function public.is_real_staff_profile(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = _user_id
      and p.is_demo is not true
      and p.active is distinct from false
  );
$$;

revoke all on function public.is_real_staff_profile(uuid) from public, anon;
grant execute on function public.is_real_staff_profile(uuid) to authenticated, service_role;

-- Hosted Supabase can inherit broad default privileges. Reset both tables to
-- the exact browser contract before recreating policies.
revoke all on table public.set_reminders from public, anon, authenticated;
grant select, insert, update on table public.set_reminders to authenticated;
grant all on table public.set_reminders to service_role;

revoke all on table public.set_follow_ups from public, anon, authenticated;
grant select, insert, update on table public.set_follow_ups to authenticated;
grant all on table public.set_follow_ups to service_role;

revoke all on table public.set_reminder_events from public, anon, authenticated;
grant select on table public.set_reminder_events to authenticated;
grant all on table public.set_reminder_events to service_role;

alter table public.set_reminders enable row level security;
alter table public.set_follow_ups enable row level security;
alter table public.set_reminder_events enable row level security;

drop policy if exists "Sales staff view set reminders" on public.set_reminders;
drop policy if exists "Staff insert own set reminders" on public.set_reminders;
drop policy if exists "Owner or admin manage set reminders" on public.set_reminders;
drop policy if exists "Sales staff claim unclaimed sets" on public.set_reminders;
drop policy if exists "Team can update set tracking" on public.set_reminders;
drop policy if exists "Admins delete erroneous sets" on public.set_reminders;

create policy "Sales view own or unclaimed sets"
on public.set_reminders for select to authenticated
using (
  (
    owner_id is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'closer')
      or public.has_role(auth.uid(), 'setter')
    )
  )
  or (
    public.is_real_staff_profile(owner_id)
    and (
      owner_id = auth.uid()
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'closer')
    )
  )
);

create policy "Sales insert own sets"
on public.set_reminders for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.is_real_staff_profile(owner_id)
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'setter')
  )
);

create policy "Sales claim unclaimed sets"
on public.set_reminders for update to authenticated
using (
  owner_id is null
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'setter')
  )
)
with check (
  owner_id = auth.uid()
  and public.is_real_staff_profile(owner_id)
);

create policy "Sales manage own set tracking"
on public.set_reminders for update to authenticated
using (
  owner_id = auth.uid()
  and public.is_real_staff_profile(owner_id)
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'setter')
  )
)
with check (
  owner_id = auth.uid()
  and public.is_real_staff_profile(owner_id)
);

create policy "Leadership manages team set tracking"
on public.set_reminders for update to authenticated
using (
  (
    owner_id is null
    or public.is_real_staff_profile(owner_id)
  )
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
  )
)
with check (
  (
    owner_id is null
    or public.is_real_staff_profile(owner_id)
  )
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
  )
);

drop policy if exists "Sales view set follow ups" on public.set_follow_ups;
drop policy if exists "Sales create set follow ups" on public.set_follow_ups;
drop policy if exists "Sales update set follow ups" on public.set_follow_ups;

create policy "Sales view set follow ups"
on public.set_follow_ups for select to authenticated
using (
  exists (
    select 1
    from public.set_reminders sr
    where sr.id = set_id
      and public.is_real_staff_profile(sr.owner_id)
      and (
        sr.owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'founder')
        or public.has_role(auth.uid(), 'cofounder')
        or public.has_role(auth.uid(), 'closer')
      )
  )
);

create policy "Sales create set follow ups"
on public.set_follow_ups for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.set_reminders sr
    where sr.id = set_id
      and public.is_real_staff_profile(sr.owner_id)
      and (
        sr.owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'founder')
        or public.has_role(auth.uid(), 'cofounder')
        or public.has_role(auth.uid(), 'closer')
      )
  )
);

create policy "Sales update set follow ups"
on public.set_follow_ups for update to authenticated
using (
  exists (
    select 1
    from public.set_reminders sr
    where sr.id = set_id
      and public.is_real_staff_profile(sr.owner_id)
      and (
        sr.owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'founder')
        or public.has_role(auth.uid(), 'cofounder')
        or public.has_role(auth.uid(), 'closer')
      )
  )
)
with check (
  exists (
    select 1
    from public.set_reminders sr
    where sr.id = set_id
      and public.is_real_staff_profile(sr.owner_id)
      and (
        sr.owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'founder')
        or public.has_role(auth.uid(), 'cofounder')
        or public.has_role(auth.uid(), 'closer')
      )
  )
);

drop policy if exists "Sales view set reminder events" on public.set_reminder_events;
create policy "Sales view set reminder events"
on public.set_reminder_events for select to authenticated
using (
  exists (
    select 1
    from public.set_reminders sr
    where sr.id = set_id
      and public.is_real_staff_profile(sr.owner_id)
      and (
        sr.owner_id = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'founder')
        or public.has_role(auth.uid(), 'cofounder')
        or public.has_role(auth.uid(), 'closer')
      )
  )
);

comment on table public.set_follow_ups is
  'Dated follow-up history for native per-setter set tracking. Submitted EODs remain the daily activity source.';

comment on table public.set_reminder_events is
  'Append-only audit history for assignment, confirmation, reminders, lifecycle, and note transitions on tracked sets.';
