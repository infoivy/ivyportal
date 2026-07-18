-- A5: Replace hardcoded placeholder training videos with a DB-driven table.
-- Admins can add real video URLs through the portal UI.

CREATE TABLE public.training_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  video_url text,
  thumbnail_color text NOT NULL DEFAULT '#3b82f6',
  category text NOT NULL DEFAULT 'General',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_videos TO authenticated;
GRANT ALL ON public.training_videos TO service_role;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active videos
CREATE POLICY "training_videos read authenticated" ON public.training_videos
FOR SELECT TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'));

-- Only admins can manage videos
CREATE POLICY "training_videos admin insert" ON public.training_videos
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "training_videos admin update" ON public.training_videos
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "training_videos admin delete" ON public.training_videos
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER training_videos_set_updated_at
BEFORE UPDATE ON public.training_videos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
