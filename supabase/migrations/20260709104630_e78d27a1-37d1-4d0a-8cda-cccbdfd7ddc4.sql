
-- commission_rates: restrict reads to admin + revenue-facing roles
DROP POLICY IF EXISTS "commission_rates read" ON public.commission_rates;
CREATE POLICY "commission_rates staff read"
ON public.commission_rates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'setter'::public.app_role)
  OR public.has_role(auth.uid(), 'closer'::public.app_role)
);

-- onboarding_templates: users see only their own role's template; admins see all
DROP POLICY IF EXISTS "Anyone signed in reads templates" ON public.onboarding_templates;
CREATE POLICY "Users read own role template"
ON public.onboarding_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), role)
);

-- ig_dashboards / ig_connections: scope founder-only policies to authenticated role
DROP POLICY IF EXISTS "Founder can manage own ig dashboard" ON public.ig_dashboards;
CREATE POLICY "Founder can manage own ig dashboard"
ON public.ig_dashboards
FOR ALL
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'::public.app_role));

DROP POLICY IF EXISTS "Founder can manage own ig connection" ON public.ig_connections;
CREATE POLICY "Founder can manage own ig connection"
ON public.ig_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'::public.app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'founder'::public.app_role));
