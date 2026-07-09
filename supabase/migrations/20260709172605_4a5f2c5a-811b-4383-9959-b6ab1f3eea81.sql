ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS setter_id uuid;
CREATE INDEX IF NOT EXISTS deals_setter_id_idx ON public.deals(setter_id);
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS setter_id uuid;
CREATE INDEX IF NOT EXISTS installments_setter_id_idx ON public.installments(setter_id);