-- Organization branding (name + logo) shown to every signed-in user in the
-- sidebar. Separate from founder_settings, which is founder/admin/cofounder
-- read-only. Single-row table; admins/founders manage it from /settings.
create table public.org_settings (
  id uuid primary key default gen_random_uuid(),
  org_name text not null default 'Ivy Portal',
  logo_url text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

create policy "Everyone signed in reads org settings"
  on public.org_settings for select to authenticated using (true);

create policy "Admins and founders manage org settings"
  on public.org_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'founder'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'founder'));

insert into public.org_settings (org_name) values ('Ivy Portal');
