-- Student daily KPIs (founder-defined 2026-07-11):
-- every student: >=3 roleplays/day and 5 loom applications/day
-- (applications_submitted); training-phase students additionally send
-- 3 looms/day to the loom review channel until approved.
ALTER TABLE public.student_eods ADD COLUMN IF NOT EXISTS roleplays integer NOT NULL DEFAULT 0;
ALTER TABLE public.student_eods ADD COLUMN IF NOT EXISTS looms_sent integer NOT NULL DEFAULT 0;
