-- Start Here guide: per-student checklist ticks so CSMs can see exactly where
-- each student is in the onboarding path (typeform → training → looms → apply).
CREATE TABLE public.student_guide_steps (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, step_key)
);

GRANT SELECT, INSERT, DELETE ON public.student_guide_steps TO authenticated;
GRANT ALL ON public.student_guide_steps TO service_role;

ALTER TABLE public.student_guide_steps ENABLE ROW LEVEL SECURITY;

-- Students manage their own ticks; staff who work students can read and fix.
CREATE POLICY "guide steps own or staff" ON public.student_guide_steps
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'csm')
  OR public.has_role(auth.uid(), 'coach')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'csm')
  OR public.has_role(auth.uid(), 'coach')
);
