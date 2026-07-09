
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.ig_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  ig_user_id TEXT,
  username TEXT,
  display_name TEXT,
  subtitle TEXT,
  access_token TEXT,
  page_id TEXT,
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_connections TO authenticated;
GRANT ALL ON public.ig_connections TO service_role;
ALTER TABLE public.ig_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founder can manage own ig connection"
  ON public.ig_connections FOR ALL
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'));

CREATE TABLE public.ig_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  period_label TEXT NOT NULL DEFAULT 'Q1 2026',
  month_label TEXT NOT NULL DEFAULT 'March 2026',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_dashboards TO authenticated;
GRANT ALL ON public.ig_dashboards TO service_role;
ALTER TABLE public.ig_dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founder can manage own ig dashboard"
  ON public.ig_dashboards FOR ALL
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_ig_connections_updated_at
  BEFORE UPDATE ON public.ig_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ig_dashboards_updated_at
  BEFORE UPDATE ON public.ig_dashboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
