-- Team members should not see action items assigned privately to other
-- members. Visibility: admins/founders see all; everyone else sees items on
-- students, items assigned to them, and items they created. Students keep
-- seeing their own items via the student linkage.
drop policy "Staff can view all action items" on public.student_action_items;

create policy "Action items: admins all, others own + student items"
  on public.student_action_items for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or (
      student_id is not null and (
        public.has_role(auth.uid(), 'coach')
        or public.has_role(auth.uid(), 'csm')
        or public.has_role(auth.uid(), 'closer')
        or public.has_role(auth.uid(), 'setter')
      )
    )
    or exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  );
