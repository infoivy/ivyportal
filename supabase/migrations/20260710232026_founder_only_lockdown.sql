-- Founder surfaces are founder-only; admin no longer implies founder access.
-- (Founder-confirmed 2026-07-11.)

-- Docs: founder-only docs need the founder role, full stop.
DROP POLICY IF EXISTS "docs readable by role" ON public.docs;
CREATE POLICY "docs readable by role" ON public.docs
  FOR SELECT TO authenticated
  USING (
    (is_founder_only AND has_role(auth.uid(), 'founder'::app_role))
    OR (
      NOT is_founder_only AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND (ur.role)::text = ANY (docs.role_visibility)
        )
      )
    )
  );

-- Content planning tables: founder-only.
DROP POLICY IF EXISTS "Founders manage content_items" ON public.content_items;
CREATE POLICY "Founders manage content_items" ON public.content_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS "Founders manage content_ideas" ON public.content_ideas;
CREATE POLICY "Founders manage content_ideas" ON public.content_ideas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS "Founders manage content_hooks" ON public.content_hooks;
CREATE POLICY "Founders manage content_hooks" ON public.content_hooks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS "Founders manage week plans" ON public.content_week_plans;
CREATE POLICY "Founders manage week plans" ON public.content_week_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

-- IG analytics: founder-only reads.
DROP POLICY IF EXISTS "Founders read ig_monthly_snapshots" ON public.ig_monthly_snapshots;
CREATE POLICY "Founders read ig_monthly_snapshots" ON public.ig_monthly_snapshots
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));

DROP POLICY IF EXISTS "Founders read ig_top_reels" ON public.ig_top_reels;
CREATE POLICY "Founders read ig_top_reels" ON public.ig_top_reels
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));
