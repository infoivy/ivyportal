-- Third setter type: full cycle (phone + DM).
-- KPI: 100 dials AND 50 leads outreached AND 3 sets daily.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_setter_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_setter_type_check
  CHECK (setter_type IN ('phone','dm','full_cycle'));
