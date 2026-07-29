begin;

-- Phase 1: backward-compatible integrity primitives. This migration lands
-- before the application deployment. Restrictive grants and RLS changes are
-- intentionally deferred to 20260729131802_enforce_sensitive_data_boundaries.sql.

-- Deals and installment plans gain non-destructive correction state.
alter table public.deals
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;
create index if not exists deals_active_date_idx
  on public.deals (deal_date desc)
  where voided_at is null;

-- Installment plan voiding waives unpaid schedule rows and preserves paid history.
alter table public.installments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;
create index if not exists installments_active_created_idx
  on public.installments (created_at desc)
  where voided_at is null;

create or replace function public.void_installment_plan(
  p_installment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  ) then
    raise exception 'Forbidden: money operator access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A void reason is required';
  end if;

  update public.installments
    set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
    where id = p_installment_id and voided_at is null;
  if not found then
    raise exception 'Active installment plan not found';
  end if;

  update public.installment_payments
    set status = 'waived',
        paid_at = null,
        notes = concat_ws(E'\n', nullif(notes, ''), 'Waived when plan was voided: ' || trim(p_reason))
    where installment_id = p_installment_id
      and status <> 'paid';
end;
$$;
revoke all on function public.void_installment_plan(uuid, text) from public, anon;
grant execute on function public.void_installment_plan(uuid, text) to authenticated;

-- Student-success operational history is voided, never hard deleted. Void
-- metadata is RPC-only so every correction records an actor and reason.
alter table public.student_calls
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;
create index if not exists student_calls_active_date_idx
  on public.student_calls (call_date desc)
  where voided_at is null;

alter table public.student_placements
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists offer_counted_at timestamptz;
create index if not exists student_placements_active_stage_idx
  on public.student_placements (stage, updated_at desc)
  where voided_at is null;

-- Existing placed rows have already contributed to the student milestone.
update public.student_placements
  set offer_counted_at = coalesce(updated_at, created_at, now())
  where stage = 'placed' and offer_counted_at is null;

create or replace function public.protect_student_call_history_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception 'Call void metadata is managed by the correction flow';
    end if;
    return new;
  end if;

  if old.voided_at is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Voided call history is immutable'
      using errcode = '55000';
  end if;

  if coalesce(current_setting('app.student_history_void', true), '') <> 'on'
    and (
      new.voided_at is distinct from old.voided_at
      or new.voided_by is distinct from old.voided_by
      or new.void_reason is distinct from old.void_reason
    )
  then
    raise exception 'Call void metadata is managed by the correction flow';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_student_call_history_metadata() from public, anon, authenticated;
drop trigger if exists student_calls_protect_history_metadata on public.student_calls;
create trigger student_calls_protect_history_metadata
  before insert or update on public.student_calls
  for each row execute function public.protect_student_call_history_metadata();

create or replace function public.protect_student_placement_history_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.voided_at is not null or new.voided_by is not null or new.void_reason is not null then
      raise exception 'Placement void metadata is managed by the correction flow';
    end if;
    new.offer_counted_at := null;
    return new;
  end if;

  if old.voided_at is not null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Voided placement history is immutable'
      using errcode = '55000';
  end if;

  if coalesce(current_setting('app.student_history_void', true), '') <> 'on'
    and (
      new.voided_at is distinct from old.voided_at
      or new.voided_by is distinct from old.voided_by
      or new.void_reason is distinct from old.void_reason
    )
  then
    raise exception 'Placement void metadata is managed by the correction flow';
  end if;
  if old.offer_counted_at is not null then
    new.offer_counted_at := old.offer_counted_at;
  elsif new.offer_counted_at is not null then
    raise exception 'Placement offer-count metadata is database managed';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_student_placement_history_metadata() from public, anon, authenticated;
drop trigger if exists student_placements_protect_history_metadata on public.student_placements;
create trigger student_placements_protect_history_metadata
  before insert or update on public.student_placements
  for each row execute function public.protect_student_placement_history_metadata();

create or replace function public.void_student_call(p_call_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'coach')
  ) then
    raise exception 'Forbidden: coach or admin access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A correction reason is required';
  end if;

  perform set_config('app.student_history_void', 'on', true);
  update public.student_calls
    set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
    where id = p_call_id and voided_at is null;
  if not found then
    raise exception 'Active call record not found';
  end if;
end;
$$;
revoke all on function public.void_student_call(uuid, text) from public, anon;
grant execute on function public.void_student_call(uuid, text) to authenticated;

create or replace function public.void_student_placement(p_placement_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
    or exists (
      select 1
      from public.student_placements p
      join public.students s on s.id = p.student_id
      where p.id = p_placement_id and s.user_id = auth.uid()
    )
  ) then
    raise exception 'Forbidden: placement correction access required';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A correction reason is required';
  end if;

  perform set_config('app.student_history_void', 'on', true);
  update public.student_placements
    set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
    where id = p_placement_id and voided_at is null;
  if not found then
    raise exception 'Active placement record not found';
  end if;
end;
$$;
revoke all on function public.void_student_placement(uuid, text) from public, anon;
grant execute on function public.void_student_placement(uuid, text) to authenticated;

-- Count an offer only once per placement row, even if its stage later moves
-- away from and back to placed.
create or replace function public.sync_placement_to_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.stage = 'placed'
    and new.voided_at is null
    and new.offer_counted_at is null
  then
    new.offer_counted_at := now();
    update public.students
      set offer_landed_at = coalesce(offer_landed_at, now()),
          offers_landed_count = coalesce(offers_landed_count, 0) + 1
      where id = new.student_id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_placement_to_student() from public, anon, authenticated;
drop trigger if exists student_placements_sync on public.student_placements;
create trigger student_placements_sync
  before insert or update of stage on public.student_placements
  for each row execute function public.sync_placement_to_student();


-- Paid rows, managed profile fields, and denormalized student names are protected.
create or replace function public.protect_paid_installment_history()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.status = 'paid' and new.paid_at is null then
      raise exception 'Paid installment rows require paid_at';
    end if;
    if new.status <> 'paid' and new.paid_at is not null then
      raise exception 'Only paid installment rows may have paid_at';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
    and old.status = 'paid'
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'Paid installment history is immutable; use an audited correction flow'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_paid_installment_history() from public, anon, authenticated;
drop trigger if exists installment_payments_protect_paid_history on public.installment_payments;
create trigger installment_payments_protect_paid_history
  before insert or update or delete on public.installment_payments
  for each row execute function public.protect_paid_installment_history();

-- A member may update their own contact and preference fields, but cannot
-- self-edit payroll, demo, active-state, or KPI controls. The first setter
-- type choice remains available for initial EOD setup and becomes admin-only
-- after it has been set.
create or replace function public.protect_profile_managed_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id
    and not public.has_role(auth.uid(), 'admin')
    and (
      new.active is distinct from old.active
      or new.is_demo is distinct from old.is_demo
      or new.eod_exempt is distinct from old.eod_exempt
      or new.base_pay_day is distinct from old.base_pay_day
      or new.base_pay_monthly is distinct from old.base_pay_monthly
      or new.commission_cap_pct is distinct from old.commission_cap_pct
      or new.csm_daily_target is distinct from old.csm_daily_target
      or (old.setter_type is not null and new.setter_type is distinct from old.setter_type)
      or new.started_on is distinct from old.started_on
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'Only an admin can change managed profile fields';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_profile_managed_fields() from public, anon, authenticated;
drop trigger if exists profiles_protect_managed_fields on public.profiles;
create trigger profiles_protect_managed_fields
  before update on public.profiles
  for each row execute function public.protect_profile_managed_fields();

-- Keep denormalized money labels in sync without granting student-success
-- roles direct write access to revenue tables.
create or replace function public.sync_student_name_to_money_records()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.full_name is distinct from old.full_name then
    update public.deals
      set student_name = new.full_name
      where student_id = new.id;
    update public.installments
      set student_name = new.full_name
      where student_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_student_name_to_money_records() from public, anon, authenticated;
drop trigger if exists students_sync_money_names on public.students;
create trigger students_sync_money_names
  after update of full_name on public.students
  for each row execute function public.sync_student_name_to_money_records();

-- Submitted EOD corrections archive the exact source row before resubmission.
create table if not exists public.eod_correction_archive (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('staff', 'student_daily', 'student_weekly')),
  source_id uuid not null,
  source_record jsonb not null,
  reason text not null check (length(trim(reason)) >= 3),
  archived_by uuid not null references auth.users(id) on delete restrict,
  archived_at timestamptz not null default now(),
  unique (record_type, source_id)
);
alter table public.eod_correction_archive enable row level security;
revoke all on public.eod_correction_archive from anon, authenticated;
grant select on public.eod_correction_archive to authenticated;
create policy "Admins view EOD correction archive"
  on public.eod_correction_archive for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.reject_staff_eod_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.eod_archive_unlock', true) = 'on'
    and public.has_role(auth.uid(), 'admin')
  then
    return old;
  end if;
  raise exception 'submitted staff EOD history is immutable; use the archived correction flow'
    using errcode = '55000';
end;
$$;
revoke all on function public.reject_staff_eod_history_mutation() from public;

create or replace function public.archive_and_unlock_eod(
  p_record_type text,
  p_source_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Forbidden: admin only';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A correction reason is required';
  end if;

  perform set_config('app.eod_archive_unlock', 'on', true);

  case p_record_type
    when 'staff' then
      delete from public.eods where id = p_source_id returning to_jsonb(eods) into v_record;
    when 'student_daily' then
      delete from public.student_eods where id = p_source_id returning to_jsonb(student_eods) into v_record;
    when 'student_weekly' then
      delete from public.student_weekly_eods where id = p_source_id returning to_jsonb(student_weekly_eods) into v_record;
    else
      raise exception 'Unsupported EOD record type';
  end case;

  if v_record is null then
    raise exception 'EOD record not found';
  end if;

  insert into public.eod_correction_archive (
    record_type, source_id, source_record, reason, archived_by
  ) values (
    p_record_type, p_source_id, v_record, trim(p_reason), auth.uid()
  );
end;
$$;
revoke all on function public.archive_and_unlock_eod(text, uuid, text) from public, anon;
grant execute on function public.archive_and_unlock_eod(text, uuid, text) to authenticated;

commit;
