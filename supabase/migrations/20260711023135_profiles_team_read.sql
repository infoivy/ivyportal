-- Any team role can read profiles (display names for feeds, leaderboards,
-- action-item senders). Students still only see their own profile.
create policy "Team roles view profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'founder', 'coach', 'csm', 'setter', 'closer')
    )
  );
