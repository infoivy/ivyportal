-- Finance opens to co-founders; founder-only surfaces stay founder-only.
drop policy "expenses founder read" on public.business_expenses;
drop policy "expenses founder insert" on public.business_expenses;
drop policy "expenses founder update" on public.business_expenses;
drop policy "expenses founder delete" on public.business_expenses;

create policy "expenses founders read" on public.business_expenses
  for select using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));
create policy "expenses founders insert" on public.business_expenses
  for insert with check (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));
create policy "expenses founders update" on public.business_expenses
  for update using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));
create policy "expenses founders delete" on public.business_expenses
  for delete using (public.has_role(auth.uid(), 'founder') or public.has_role(auth.uid(), 'cofounder'));

create policy "cofounders read founder_settings" on public.founder_settings
  for select using (public.has_role(auth.uid(), 'cofounder'));
