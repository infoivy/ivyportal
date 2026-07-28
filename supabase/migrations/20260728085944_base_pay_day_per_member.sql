-- Base pay day is PER MEMBER, anchored to when they started (founder-corrected
-- 2026-07-28): "base pay is one time a month, its not like commissions, and
-- its based off which day they started". Supersedes the org-wide
-- founder_settings.base_pay_day added earlier today (column left in place,
-- no longer read).
alter table public.profiles add column base_pay_day int not null default 1
  check (base_pay_day between 1 and 31);
