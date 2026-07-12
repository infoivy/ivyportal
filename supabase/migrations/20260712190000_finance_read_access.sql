-- Payouts + Finance are founder/cofounder surfaces; their math reads roles,
-- installments, payments, and commission rates. Additive select-only grants.
create policy "Founder/cofounder view all roles"
  on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "Founder/cofounder view installments"
  on public.installments for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "Founder/cofounder view installment payments"
  on public.installment_payments for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "Founder/cofounder read commission rates"
  on public.commission_rates for select to authenticated
  using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));
