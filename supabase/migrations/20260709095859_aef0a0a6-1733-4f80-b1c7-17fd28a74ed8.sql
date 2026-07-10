
-- Founder access is assigned by an administrator after signup. Do not seed a
-- historical user ID here: a fresh Supabase project has no matching auth user.

-- Enums
CREATE TYPE public.content_platform AS ENUM ('instagram','tiktok','youtube','twitter','linkedin','threads','other');
CREATE TYPE public.content_status AS ENUM ('idea','scripted','filmed','edited','posted');

-- content_items
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE,
  platform public.content_platform NOT NULL DEFAULT 'instagram',
  format TEXT,
  hook TEXT NOT NULL,
  script TEXT,
  status public.content_status NOT NULL DEFAULT 'idea',
  link_when_posted TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage content_items"
  ON public.content_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER content_items_updated_at BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_content_items_date ON public.content_items(scheduled_date);
CREATE INDEX idx_content_items_status ON public.content_items(status);

-- content_ideas
CREATE TABLE public.content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link TEXT,
  promoted_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_ideas TO authenticated;
GRANT ALL ON public.content_ideas TO service_role;

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage content_ideas"
  ON public.content_ideas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE INDEX idx_content_ideas_created ON public.content_ideas(created_at DESC);
