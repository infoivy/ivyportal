-- Extend content_items with funnel + week fields
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS funnel_stage text CHECK (funnel_stage IN ('tof','mof'));
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS week_start date;
CREATE INDEX IF NOT EXISTS content_items_week_start_idx ON public.content_items(week_start);

-- 10 idea slots per week (5 MOF, 5 TOF)
CREATE TABLE public.content_week_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 10),
  stage text NOT NULL CHECK (stage IN ('mof','tof')),
  text text NOT NULL DEFAULT '',
  matched_creative_type text,
  promoted_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, position)
);
CREATE INDEX content_week_ideas_week_idx ON public.content_week_ideas(week_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_week_ideas TO authenticated;
GRANT ALL ON public.content_week_ideas TO service_role;

ALTER TABLE public.content_week_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage week ideas"
ON public.content_week_ideas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_week_ideas_updated_at
BEFORE UPDATE ON public.content_week_ideas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-week plan record (marks whether the 7 slots have been auto-generated)
CREATE TABLE public.content_week_plans (
  week_start date PRIMARY KEY,
  auto_provisioned boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_week_plans TO authenticated;
GRANT ALL ON public.content_week_plans TO service_role;

ALTER TABLE public.content_week_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage week plans"
ON public.content_week_plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_week_plans_updated_at
BEFORE UPDATE ON public.content_week_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();