ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'csm';

ALTER TABLE public.eods
  ADD COLUMN IF NOT EXISTS looms_reviewed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roleplays_reviewed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS student_checkins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalations_resolved integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.csm_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.csm_student_notes TO authenticated;
GRANT ALL ON public.csm_student_notes TO service_role;

ALTER TABLE public.csm_student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CSM team can view csm student notes" ON public.csm_student_notes;
CREATE POLICY "CSM team can view csm student notes"
ON public.csm_student_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'coach'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'csm'
  )
);

DROP POLICY IF EXISTS "CSM team can create own csm student notes" ON public.csm_student_notes;
CREATE POLICY "CSM team can create own csm student notes"
ON public.csm_student_notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = 'csm'
    )
  )
);

DROP POLICY IF EXISTS "Users update own csm notes and admins update all" ON public.csm_student_notes;
CREATE POLICY "Users update own csm notes and admins update all"
ON public.csm_student_notes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users delete own csm notes and admins delete all" ON public.csm_student_notes;
CREATE POLICY "Users delete own csm notes and admins delete all"
ON public.csm_student_notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "CSMs view students" ON public.students;
CREATE POLICY "CSMs view students"
ON public.students
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'csm'
  )
);

DROP POLICY IF EXISTS "CSMs view profiles" ON public.profiles;
CREATE POLICY "CSMs view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = 'csm'
  )
);

DROP TRIGGER IF EXISTS set_csm_student_notes_updated_at ON public.csm_student_notes;
CREATE TRIGGER set_csm_student_notes_updated_at
BEFORE UPDATE ON public.csm_student_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();