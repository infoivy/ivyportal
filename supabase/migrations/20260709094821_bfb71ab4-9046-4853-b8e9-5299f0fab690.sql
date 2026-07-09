
-- Testimonials table
CREATE TYPE public.testimonial_type AS ENUM ('video', 'image', 'text', 'trustpilot');
CREATE TYPE public.testimonial_status AS ENUM ('requested', 'received', 'approved', 'published');

CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  type public.testimonial_type NOT NULL,
  title TEXT,
  content_text TEXT,
  file_path TEXT,
  source_url TEXT,
  collected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  collected_at TIMESTAMPTZ,
  status public.testimonial_status NOT NULL DEFAULT 'received',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Staff (any team role) can view
CREATE POLICY "Staff can view testimonials" ON public.testimonials
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coach') OR
    public.has_role(auth.uid(), 'closer') OR
    public.has_role(auth.uid(), 'setter') OR
    public.has_role(auth.uid(), 'csm')
  );

-- Staff can insert/update
CREATE POLICY "Staff can insert testimonials" ON public.testimonials
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coach') OR
    public.has_role(auth.uid(), 'closer') OR
    public.has_role(auth.uid(), 'setter') OR
    public.has_role(auth.uid(), 'csm')
  );

CREATE POLICY "Staff can update testimonials" ON public.testimonials
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'coach') OR
    public.has_role(auth.uid(), 'closer') OR
    public.has_role(auth.uid(), 'setter') OR
    public.has_role(auth.uid(), 'csm')
  );

-- Only admins can delete
CREATE POLICY "Admins can delete testimonials" ON public.testimonials
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_testimonials_student ON public.testimonials(student_id);
CREATE INDEX idx_testimonials_type ON public.testimonials(type);
CREATE INDEX idx_testimonials_status ON public.testimonials(status);

-- Add testimonial_requested flag to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS testimonial_requested BOOLEAN NOT NULL DEFAULT false;

-- Trigger: when a testimonial is inserted/updated to 'received' or beyond, auto-check the student flag
CREATE OR REPLACE FUNCTION public.testimonial_sync_student_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL AND NEW.status IN ('received','approved','published') THEN
    IF NEW.type = 'trustpilot' THEN
      UPDATE public.students SET trustpilot_collected = true WHERE id = NEW.student_id AND trustpilot_collected = false;
    ELSE
      UPDATE public.students SET testimonial_collected = true WHERE id = NEW.student_id AND testimonial_collected = false;
    END IF;
  END IF;
  IF NEW.student_id IS NOT NULL AND NEW.status = 'requested' THEN
    UPDATE public.students SET testimonial_requested = true WHERE id = NEW.student_id AND testimonial_requested = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER testimonials_sync_student
  AFTER INSERT OR UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.testimonial_sync_student_flags();

-- Storage policies for private testimonials bucket
CREATE POLICY "Staff can read testimonial files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'testimonials' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'coach') OR
      public.has_role(auth.uid(), 'closer') OR
      public.has_role(auth.uid(), 'setter') OR
      public.has_role(auth.uid(), 'csm')
    )
  );

CREATE POLICY "Staff can upload testimonial files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'testimonials' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'coach') OR
      public.has_role(auth.uid(), 'closer') OR
      public.has_role(auth.uid(), 'setter') OR
      public.has_role(auth.uid(), 'csm')
    )
  );

CREATE POLICY "Admins can delete testimonial files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'testimonials' AND public.has_role(auth.uid(), 'admin'));
