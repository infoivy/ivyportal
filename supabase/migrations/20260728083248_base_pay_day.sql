-- Which day of the month team base pay leaves the account (founder-requested
-- 2026-07-28). Drives where base pay lands on the cash-in calendar's
-- money-out layer. Clamped to the month's length at render time.
alter table public.founder_settings add column base_pay_day int not null default 1
  check (base_pay_day between 1 and 31);
