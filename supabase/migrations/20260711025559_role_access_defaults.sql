-- Per-role access defaults: which pages a business role sees, and whether
-- money figures are blurred for them. Visibility layer on top of RLS —
-- real data security stays in table policies.
create table public.role_access (
  role public.app_role primary key,
  hidden_pages text[] not null default '{}',
  hide_money boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.role_access enable row level security;

-- Everyone signed in reads it (the nav needs it); only admins change it.
create policy "role_access readable" on public.role_access
  for select using (auth.uid() is not null);
create policy "role_access admin insert" on public.role_access
  for insert with check (public.has_role(auth.uid(), 'admin'));
create policy "role_access admin update" on public.role_access
  for update using (public.has_role(auth.uid(), 'admin'));
create policy "role_access admin delete" on public.role_access
  for delete using (public.has_role(auth.uid(), 'admin'));
