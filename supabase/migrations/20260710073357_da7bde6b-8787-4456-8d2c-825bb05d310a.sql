-- Founder Hub content engine expansion

-- 1. Extend content_items with recording/production fields
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS script text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS raw_video_url text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS edited_reel_url text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS duration_sec integer;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT ARRAY['instagram']::text[];
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS reedit_flag boolean NOT NULL DEFAULT false;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
-- Hook diagnostic (populated after posting)
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS post_views integer;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS post_avg_watch_sec numeric;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS post_new_follows integer;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS hook_diagnosis text;

-- 2. Extend content_ideas capture inbox
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS trigger_type text CHECK (trigger_type IN ('client_conv','own_realization','result','repeated_question'));
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS funnel_guess text CHECK (funnel_guess IN ('tof','mof'));
ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS harvested boolean NOT NULL DEFAULT false;

-- 3. Hook Library
CREATE TABLE IF NOT EXISTS public.content_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  example text,
  category text,
  funnel_stage text CHECK (funnel_stage IN ('tof','mof')),
  favorite boolean NOT NULL DEFAULT false,
  times_used integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_hooks TO authenticated;
GRANT ALL ON public.content_hooks TO service_role;

ALTER TABLE public.content_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage content_hooks" ON public.content_hooks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_hooks_updated_at BEFORE UPDATE ON public.content_hooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_content_hooks_stage ON public.content_hooks(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_content_hooks_fav ON public.content_hooks(favorite);

-- 4. Founder settings (singleton, key/value style — flexible)
CREATE TABLE IF NOT EXISTS public.founder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_day_of_week integer NOT NULL DEFAULT 4, -- Thursday
  top_setter_bonus_pct numeric NOT NULL DEFAULT 1.0,
  weekly_cash_bonus_threshold numeric NOT NULL DEFAULT 7500,
  weekly_cash_bonus_pct numeric NOT NULL DEFAULT 1.0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.founder_settings TO authenticated;
GRANT ALL ON public.founder_settings TO service_role;

ALTER TABLE public.founder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read founder_settings" ON public.founder_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Founders write founder_settings" ON public.founder_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER founder_settings_updated_at BEFORE UPDATE ON public.founder_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Instagram monthly snapshots + top reels
CREATE TABLE IF NOT EXISTS public.ig_monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE, -- first-of-month
  followers integer NOT NULL DEFAULT 0,
  new_followers integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  interactions integer NOT NULL DEFAULT 0,
  dms integer NOT NULL DEFAULT 0,
  link_clicks integer NOT NULL DEFAULT 0,
  posts integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_monthly_snapshots TO authenticated;
GRANT ALL ON public.ig_monthly_snapshots TO service_role;

ALTER TABLE public.ig_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in read ig_monthly_snapshots" ON public.ig_monthly_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Founders write ig_monthly_snapshots" ON public.ig_monthly_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ig_monthly_snapshots_updated_at BEFORE UPDATE ON public.ig_monthly_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ig_top_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  topic text NOT NULL,
  pillar text,
  views integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  avg_watch_sec numeric,
  new_follows integer,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_top_reels TO authenticated;
GRANT ALL ON public.ig_top_reels TO service_role;

ALTER TABLE public.ig_top_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in read ig_top_reels" ON public.ig_top_reels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Founders write ig_top_reels" ON public.ig_top_reels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ig_top_reels_updated_at BEFORE UPDATE ON public.ig_top_reels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ig_top_reels_month ON public.ig_top_reels(month);

-- 6. Extend commission_rates for bonus rules (setter_pif_bonus is kept but no longer used)
ALTER TABLE public.commission_rates ADD COLUMN IF NOT EXISTS top_setter_bonus_pct numeric NOT NULL DEFAULT 1.0;
ALTER TABLE public.commission_rates ADD COLUMN IF NOT EXISTS weekly_cash_bonus_threshold numeric NOT NULL DEFAULT 7500;
ALTER TABLE public.commission_rates ADD COLUMN IF NOT EXISTS weekly_cash_bonus_pct numeric NOT NULL DEFAULT 1.0;

-- Ensure a default founder_settings row
INSERT INTO public.founder_settings (recording_day_of_week)
SELECT 4 WHERE NOT EXISTS (SELECT 1 FROM public.founder_settings);
