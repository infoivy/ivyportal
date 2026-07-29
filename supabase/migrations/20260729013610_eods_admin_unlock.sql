-- Founder-approved 2026-07-29: a submitted EOD can trap a member when their
-- device clock lags their real day (report lands on the wrong date and the
-- insert-only form reads "locked"). Admins get a narrow unlock: DELETE a
-- single report so the member can resubmit. Everything else stays
-- insert-only; setters/closers still cannot touch submitted rows.
GRANT DELETE ON public.eods TO authenticated;
CREATE POLICY "Admins unlock eods for resubmission"
  ON public.eods FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
