-- General team channel: open conversation, issues, tips, bug reports.
create table public.team_chat (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(body) between 1 and 4000),
  kind text not null default 'general' check (kind in ('general', 'issue', 'tip', 'bug')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index team_chat_created_at_idx on public.team_chat (created_at desc);
alter table public.team_chat enable row level security;

grant select, insert, delete on public.team_chat to authenticated;
grant all on public.team_chat to service_role;

-- Whole team reads and posts; history is permanent (no update policy);
-- admins can delete a message if it truly must go.
create policy "team_chat team read" on public.team_chat
  for select using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder') or has_role(auth.uid(), 'coach')
    or has_role(auth.uid(), 'csm') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
  );
create policy "team_chat team insert" on public.team_chat
  for insert with check (
    created_by = auth.uid() and (
      has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder') or has_role(auth.uid(), 'coach')
      or has_role(auth.uid(), 'csm') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
    )
  );
create policy "team_chat admin delete" on public.team_chat
  for delete using (has_role(auth.uid(), 'admin'));
