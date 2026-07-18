-- Manual "payment processor balance today" input for the Finance page's
-- projected-balance view.
alter table public.founder_settings
  add column if not exists processor_balance numeric,
  add column if not exists processor_balance_updated_at timestamptz;
