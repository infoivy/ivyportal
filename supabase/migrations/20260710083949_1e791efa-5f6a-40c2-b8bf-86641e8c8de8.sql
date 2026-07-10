
-- Restrict founder_settings reads to founders/admins
DROP POLICY IF EXISTS "Anyone signed in can read founder_settings" ON public.founder_settings;
CREATE POLICY "Founders read founder_settings" ON public.founder_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Restrict ig_monthly_snapshots reads to founders/admins
DROP POLICY IF EXISTS "Signed in read ig_monthly_snapshots" ON public.ig_monthly_snapshots;
CREATE POLICY "Founders read ig_monthly_snapshots" ON public.ig_monthly_snapshots
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Restrict ig_top_reels reads to founders/admins
DROP POLICY IF EXISTS "Signed in read ig_top_reels" ON public.ig_top_reels;
CREATE POLICY "Founders read ig_top_reels" ON public.ig_top_reels
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Scope docs SELECT policy to authenticated role only (was public)
DROP POLICY IF EXISTS "docs readable by role" ON public.docs;
CREATE POLICY "docs readable by role" ON public.docs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR ((NOT is_founder_only) AND (EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND (ur.role)::text = ANY (docs.role_visibility)
    )))
    OR (is_founder_only AND has_role(auth.uid(), 'founder'::app_role))
  );
