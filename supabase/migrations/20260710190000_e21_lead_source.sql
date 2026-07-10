-- E21: Lead source tracking on students and deals
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS source text;
