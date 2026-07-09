
CREATE TYPE public.csm_tally_kind AS ENUM ('loom', 'roleplay', 'checkin', 'escalation');

CREATE TABLE public.csm_tally (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.csm_tally_kind NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.csm_tally TO authenticated;
GRANT ALL ON public.csm_tally TO service_role;

ALTER TABLE public.csm_tally ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and CSMs view csm_tally"
  ON public.csm_tally FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'csm'));

CREATE POLICY "CSMs insert own csm_tally"
  ON public.csm_tally FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'csm'))
  );

CREATE POLICY "Owner or admin update csm_tally"
  ON public.csm_tally FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin delete csm_tally"
  ON public.csm_tally FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_csm_tally_user_created ON public.csm_tally(user_id, created_at DESC);
CREATE INDEX idx_csm_tally_student ON public.csm_tally(student_id);
