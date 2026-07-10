-- Editable quarterly team goals shown on the dashboard (admin-managed).
-- Shape: {"dms": int, "convos": int, "calls": int, "shows": int, "showRate": int, "viral": int}
ALTER TABLE public.founder_settings ADD COLUMN IF NOT EXISTS quarterly_goals jsonb;
