-- The assignee of a team action item can update it (tick it off) even if
-- they are a setter/closer who didn't create it.
create policy "Assignee can update own action items" on public.student_action_items
  for update using (assignee_id = auth.uid());
