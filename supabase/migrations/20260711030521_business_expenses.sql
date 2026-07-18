-- Founder-only business expense tracker for the Finance page.
create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'USD',
  -- recurring monthly on `due_day`, or a one-off on `one_off_date`
  recurring boolean not null default true,
  due_day int check (due_day between 1 and 31),
  one_off_date date,
  category text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.business_expenses enable row level security;

create policy "expenses founder read" on public.business_expenses
  for select using (public.has_role(auth.uid(), 'founder'));
create policy "expenses founder insert" on public.business_expenses
  for insert with check (public.has_role(auth.uid(), 'founder'));
create policy "expenses founder update" on public.business_expenses
  for update using (public.has_role(auth.uid(), 'founder'));
create policy "expenses founder delete" on public.business_expenses
  for delete using (public.has_role(auth.uid(), 'founder'));
