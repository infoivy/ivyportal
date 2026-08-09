-- Portal opens (founder-asked 2026-08-09 follow-up): distinguish "how many
-- times they opened the portal" from the 10-minute keepalive pings. An open
-- is a sign-in or a tab refocus; pings keep measuring time-in-portal.

alter table public.portal_activity add column if not exists opens integer not null default 0;

drop function if exists public.portal_ping(date);

create or replace function public.portal_ping(_day date, _open boolean default false)
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
  insert into public.portal_activity as pa (user_id, day, first_seen_at, last_seen_at, pings, opens)
  values (auth.uid(), _day, now(), now(), 1, case when _open then 1 else 0 end)
  on conflict (user_id, day) do update
    set last_seen_at = now(),
        pings = pa.pings + 1,
        opens = pa.opens + (case when _open then 1 else 0 end);
end;
$$;

grant execute on function public.portal_ping(date, boolean) to authenticated;
