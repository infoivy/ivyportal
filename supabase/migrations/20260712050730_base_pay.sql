-- Monthly base pay per member (e.g. CSM $500/month), shown on Payouts
-- alongside per-period commissions. Admin-edited on the Team page.
alter table public.profiles
  add column if not exists base_pay_monthly numeric;
