-- Per-student EOD tracking switch (founder request 2026-07-14): some students
-- (e.g. scholarship placements) shouldn't trigger missed-EOD / at-risk alerts.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS eod_exempt boolean NOT NULL DEFAULT false;
