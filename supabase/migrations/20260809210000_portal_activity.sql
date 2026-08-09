-- Portal presence (founder-asked 2026-08-09): one row per person per local
-- day answers "who was in the portal, at what time, and roughly how long"
-- for students and staff alike. Presence only: first/last seen + ping count.
-- No pages, no content, no tracking beyond that.

create table if not exists public.portal_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pings integer not null default 1,
  primary key (user_id, day)
);

grant select, insert, update on public.portal_activity to authenticated;
grant all on public.portal_activity to service_role;
alter table public.portal_activity enable row level security;

-- People write only their own presence.
drop policy if exists "Own presence insert" on public.portal_activity;
create policy "Own presence insert" on public.portal_activity
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Own presence update" on public.portal_activity;
create policy "Own presence update" on public.portal_activity
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Read: yourself, or the fulfillment/leadership roles that work people.
drop policy if exists "Own or staff read presence" on public.portal_activity;
create policy "Own or staff read presence" on public.portal_activity
  for select to authenticated using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
  );

-- Atomic ping: upsert today's row and bump the counter. The client sends its
-- LOCAL day (same rule as EODs); anything implausible falls back to UTC date.
create or replace function public.portal_ping(_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if _day is null or abs(_day - current_date) > 1 then
    _day := current_date;
  end if;
  insert into public.portal_activity as pa (user_id, day, first_seen_at, last_seen_at, pings)
  values (auth.uid(), _day, now(), now(), 1)
  on conflict (user_id, day) do update
    set last_seen_at = now(), pings = pa.pings + 1;
end;
$$;

grant execute on function public.portal_ping(date) to authenticated;
