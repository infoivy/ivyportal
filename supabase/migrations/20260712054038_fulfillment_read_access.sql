-- The fulfillment cockpit (CSM hub, health scores, bell alerts) reads
-- students + their EODs/calls/notes/tallies. Grant the roles those surfaces
-- admit — csm was missing eods/calls reads entirely (health scores silently
-- computed from zero data), and founder/cofounder could not read students.
-- Additive select-only policies; nothing existing is weakened.

create policy "Founder/cofounder view students"
  on public.students for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "CSM/founder/cofounder view student eods"
  on public.student_eods for select to authenticated
  using (
    public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );

create policy "CSM/founder/cofounder view student calls"
  on public.student_calls for select to authenticated
  using (
    public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );

create policy "Founder/cofounder view csm student notes"
  on public.csm_student_notes for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "Founder/cofounder view csm tally"
  on public.csm_tally for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "Cofounder views student action items"
  on public.student_action_items for select to authenticated
  using (public.has_role(auth.uid(), 'cofounder') and student_id is not null);
