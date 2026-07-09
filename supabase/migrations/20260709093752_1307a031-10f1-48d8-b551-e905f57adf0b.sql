
-- 1) dashboard_prefs on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) service_credentials
CREATE TABLE public.service_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  label TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_credentials TO authenticated;
GRANT ALL ON public.service_credentials TO service_role;
ALTER TABLE public.service_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_credentials admin all" ON public.service_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER service_credentials_updated_at BEFORE UPDATE ON public.service_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
