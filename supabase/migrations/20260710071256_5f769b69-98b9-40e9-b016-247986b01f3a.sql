
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS setter_type text CHECK (setter_type IN ('phone','dm'));
ALTER TABLE public.eods ADD COLUMN IF NOT EXISTS leads_contacted integer NOT NULL DEFAULT 0;
ALTER TABLE public.eods ADD COLUMN IF NOT EXISTS dials integer NOT NULL DEFAULT 0;
