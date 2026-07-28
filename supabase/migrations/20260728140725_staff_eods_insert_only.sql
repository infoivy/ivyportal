-- Submitted staff EODs are operational history. Real rows are insert-only.
-- Corrections must use a future append-only adjustment workflow rather than
-- rewriting or deleting the original report.

drop policy if exists "Users manage own eods" on public.eods;
drop policy if exists "Users delete own eods" on public.eods;
drop policy if exists "Users view own eods" on public.eods;
drop policy if exists "Users insert own eods" on public.eods;

create policy "Users view own eods"
  on public.eods for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own eods"
  on public.eods for insert to authenticated
  with check (
    auth.uid() = user_id
    and is_demo is not true
  );

-- RLS is the row boundary. Explicit grants ensure browser roles cannot mutate
-- any real or demo history even if a future policy is accidentally broadened.
-- The existing "Admins and closers view all eods" SELECT policy is retained;
-- activity-only team readers use the money-free eods_activity_real view.
revoke all on table public.eods from anon;
revoke all on table public.eods from authenticated;
grant select, insert on table public.eods to authenticated;

-- The canonical schema uses UUID ids with gen_random_uuid(), not a sequence.
-- Fail closed if the target drifted to a sequence-backed id so dependent
-- privileges cannot silently weaken this insert-only contract.
do $$
begin
  if pg_get_serial_sequence('public.eods', 'id') is not null then
    raise exception 'unexpected sequence-backed public.eods.id; review dependent privileges before release';
  end if;
end;
$$;

create or replace function public.reject_staff_eod_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'submitted staff EOD history is immutable; append a correction instead'
    using errcode = '55000';
  return old;
end;
$$;

revoke all on function public.reject_staff_eod_history_mutation() from public;

drop trigger if exists reject_staff_eod_history_mutation on public.eods;
create trigger reject_staff_eod_history_mutation
  before update or delete on public.eods
  for each row
  when (old.is_demo is not true)
  execute function public.reject_staff_eod_history_mutation();

comment on function public.reject_staff_eod_history_mutation() is
  'Blocks updates and deletes of submitted real staff EOD records. Corrections must be append-only.';
