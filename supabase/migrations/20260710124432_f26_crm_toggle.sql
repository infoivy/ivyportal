-- F26: CRM page behind admin toggle + monthly cash goal column
ALTER TABLE public.founder_settings ADD COLUMN IF NOT EXISTS crm_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.founder_settings ADD COLUMN IF NOT EXISTS monthly_cash_goal numeric;
