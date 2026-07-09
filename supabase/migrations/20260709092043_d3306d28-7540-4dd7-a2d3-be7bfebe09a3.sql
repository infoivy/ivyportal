
-- ============ deals ============
CREATE TYPE public.deal_payment_type AS ENUM ('pif','deposit','split');

CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  closer_id UUID NOT NULL,
  program_type TEXT NOT NULL DEFAULT '',
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  cash_collected_upfront NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_collected_upfront >= 0),
  payment_type public.deal_payment_type NOT NULL DEFAULT 'pif',
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_url TEXT,
  fathom_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals admin all" ON public.deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "deals team read" ON public.deals FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'closer')
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'csm')
  );

CREATE POLICY "deals closer/coach insert" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'closer')
    OR public.has_role(auth.uid(), 'coach')
  );

CREATE POLICY "deals own update" ON public.deals FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX deals_deal_date_idx ON public.deals(deal_date DESC);
CREATE INDEX deals_closer_idx ON public.deals(closer_id, deal_date DESC);

CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ commission_rates ============
CREATE TABLE public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  rate NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 1),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.commission_rates TO authenticated;
GRANT ALL ON public.commission_rates TO service_role;
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rates read" ON public.commission_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "commission_rates admin write" ON public.commission_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER commission_rates_updated_at BEFORE UPDATE ON public.commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.commission_rates (key, label, rate, notes) VALUES
  ('new_close', 'New close', 0.10, 'Standard commission on any new close'),
  ('pif_under_30d', 'PIF within 30 days', 0.12, 'Bonus rate when full amount is paid in the first 30 days'),
  ('payment_plan', 'Payment plan', 0.05, 'Commission on split/installment deals');

-- ============ eods closer extensions ============
ALTER TABLE public.eods
  ADD COLUMN IF NOT EXISTS calls_taken INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposits INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deferred_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_ups_done INT NOT NULL DEFAULT 0;
