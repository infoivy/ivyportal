-- Founder-directed 2026-07-29: CSM check-ins become per-student RECORDS so
-- the team sees who was reached today, who is 2+ days cold, and never
-- doubles up on the same student. The EOD check-in count stays self-reported;
-- this is the coverage ledger.
CREATE TABLE public.student_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  csm_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX student_checkins_student_idx ON public.student_checkins (student_id, checked_at DESC);
CREATE INDEX student_checkins_checked_idx ON public.student_checkins (checked_at DESC);

ALTER TABLE public.student_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_checkins FROM anon, authenticated;
GRANT SELECT, INSERT ON public.student_checkins TO authenticated;
GRANT DELETE ON public.student_checkins TO authenticated;

CREATE POLICY "Fulfillment reads checkins" ON public.student_checkins FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder') OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'csm')
  );
CREATE POLICY "Fulfillment logs own checkins" ON public.student_checkins FOR INSERT TO authenticated
  WITH CHECK (
    csm_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach')
      OR public.has_role(auth.uid(), 'csm')
    )
  );
CREATE POLICY "Admins remove checkins" ON public.student_checkins FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- every check-in lands in the activity log too
CREATE TRIGGER audit_student_checkins
  AFTER INSERT OR UPDATE OR DELETE ON public.student_checkins
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
