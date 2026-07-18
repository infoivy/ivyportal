-- CSMs run fulfillment day-to-day and now own two student-state actions
-- (founder-directed 2026-07-18): approving looms (phase → applying, flips the
-- daily EOD from 3-looms-for-review to 5-applications) and the Start Here
-- unlock override. Both are students-table updates, which were
-- admin/coach/closer only.
drop policy "Admins/coaches/closers update students" on public.students;
create policy "Admins/coaches/closers/CSMs update students" on public.students
  for update using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'coach')
    or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'csm')
  ) with check (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'coach')
    or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'csm')
  );
