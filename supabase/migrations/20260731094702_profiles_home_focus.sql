-- Per-founder home views (founder 2026-07-31): each founder's home leads
-- with the department they run. 'fulfillment' = CSM/student delivery
-- picture (Faizan); 'sales' = sets/volume/pipeline picture (Abu Bilal);
-- NULL keeps the default leadership home.
ALTER TABLE public.profiles
  ADD COLUMN home_focus text CHECK (home_focus IN ('sales', 'fulfillment'));
