-- CSM daily outreach KPI (founder-set 2026-07-14): full-time = 10 students
-- reached per day, part-time = 5. Per-profile so each CSM has their own bar.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS csm_daily_target integer NOT NULL DEFAULT 10;
