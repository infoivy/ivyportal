UPDATE public.students SET calls_included = LEAST(calls_included, 10), calls_allotted = LEAST(calls_allotted, 10);
ALTER TABLE public.students ALTER COLUMN calls_included SET DEFAULT 10;
ALTER TABLE public.students ALTER COLUMN calls_allotted SET DEFAULT 10;
ALTER TABLE public.students ADD CONSTRAINT calls_included_max_10 CHECK (calls_included <= 10);
ALTER TABLE public.students ADD CONSTRAINT calls_allotted_max_10 CHECK (calls_allotted <= 10);