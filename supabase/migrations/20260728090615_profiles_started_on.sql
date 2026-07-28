-- The founder picks each member's FIRST DAY with a calendar; the monthly base
-- pay day derives from it (day-of-month, clamped to short months at render).
-- base_pay_day stays as the derived value every consumer reads.
alter table public.profiles add column started_on date;
