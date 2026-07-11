-- Installment records are closer/admin business data: closers must be able
-- to read plans and payments (they also write them when logging deals, and
-- insert ... returning requires SELECT).
drop policy "Staff can view installments" on public.installments;
create policy "Staff can view installments" on public.installments
  for select using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );

drop policy "Staff can view payments" on public.installment_payments;
create policy "Staff can view payments" on public.installment_payments
  for select using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'coach') or has_role(auth.uid(), 'csm')
  );
