-- Align content_items/content_ideas with the documented rule (founder/admin)
-- and with content_hooks + content_week_plans, which already allow both.
DROP POLICY IF EXISTS "Founders manage content_items" ON public.content_items;
CREATE POLICY "Founders manage content_items"
  ON public.content_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Founders manage content_ideas" ON public.content_ideas;
CREATE POLICY "Founders manage content_ideas"
  ON public.content_ideas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'admin'));
