-- S6: Add is_demo flag to data tables for seed/teardown lifecycle
ALTER TABLE public.eods ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.ig_monthly_snapshots ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.student_action_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
