-- Keep showcase identities out of operational rosters and accountability metrics.
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

-- Backfill the existing deterministic demo cast created by scripts/seed-demo.mjs.
update public.profiles as profile
set is_demo = true
from auth.users as account
where profile.id = account.id
  and lower(coalesce(account.email, '')) like '%@isa.demo'
  and profile.is_demo is distinct from true;

create index if not exists profiles_real_active_idx
  on public.profiles (active, id)
  where is_demo = false;

comment on column public.profiles.is_demo is
  'True for showcase identities that must not enter operational Home, Performance, or directory rosters.';
