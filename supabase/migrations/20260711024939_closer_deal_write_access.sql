-- Closers log deals: they must be able to create the student record, set its
-- payment state/coaching allowance, and write the installment plan. These
-- were admin/coach(/setter/csm) only, so a closer's Log-a-close silently
-- skipped the student update and failed the plan insert.
drop policy "Admins/coaches insert students" on public.students;
create policy "Admins/coaches/closers insert students" on public.students
  for insert with check (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'closer')
  );

drop policy "Admins/coaches update students" on public.students;
create policy "Admins/coaches/closers update students" on public.students
  for update using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'closer')
  );

drop policy "Staff can insert installments" on public.installments;
create policy "Staff can insert installments" on public.installments
  for insert with check (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );

drop policy "Staff can update installments" on public.installments;
create policy "Staff can update installments" on public.installments
  for update using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );

drop policy "Staff can insert payments" on public.installment_payments;
create policy "Staff can insert payments" on public.installment_payments
  for insert with check (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );

drop policy "Staff can update payments" on public.installment_payments;
create policy "Staff can update payments" on public.installment_payments
  for update using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );
