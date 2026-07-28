-- Per-member payout confirmations (founder-requested 2026-07-28).
-- One row = "this member's payout for this semi-monthly period left the
-- account". amount_paid snapshots the computed total at confirm time so the
-- record survives later data edits. The founder gets an urgent daily
-- reminder until every member with a nonzero payout in an ended period is
-- confirmed.
create table public.payout_confirmations (
  period_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paid numeric not null default 0,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id) on delete cascade,
  primary key (period_start, user_id)
);

alter table public.payout_confirmations enable row level security;

create policy "Payout admins manage confirmations"
  on public.payout_confirmations for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );
