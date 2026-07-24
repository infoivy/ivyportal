-- Students could not see their assigned coach (founder-reported 2026-07-25):
-- every profiles SELECT policy requires a team role, so the portal's coach
-- lookup silently returned nothing and the card stayed "Will be assigned
-- soon". Narrowest possible fix: a student may read exactly the one profile
-- row that is their own coach.
create policy "Students view their coach profile" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.user_id = auth.uid() and s.coach_id = profiles.id
    )
  );
