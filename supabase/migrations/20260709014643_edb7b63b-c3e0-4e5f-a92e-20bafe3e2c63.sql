
-- 1. Profiles: restrict SELECT
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coach'::public.app_role)
  );

-- 2. user_roles: explicit deny for non-admin writes (already enforced by ALL policy, add SELECT-safety)
-- Ensure no INSERT/UPDATE/DELETE possible except by admins. The existing "Admins manage roles" ALL policy already handles this.
-- Add restrictive policy to be defence-in-depth: block any write not by admin.
DROP POLICY IF EXISTS "Only admins can write roles" ON public.user_roles;
CREATE POLICY "Only admins can write roles" ON public.user_roles
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Keep users' ability to view their own roles: RESTRICTIVE breaks that. Adjust: only restrict writes.
DROP POLICY IF EXISTS "Only admins can write roles" ON public.user_roles;
CREATE POLICY "Block non-admin role writes - insert" ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Block non-admin role writes - update" ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Block non-admin role writes - delete" ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Revoke EXECUTE on SECURITY DEFINER functions that are trigger-only
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_student_on_signup() FROM PUBLIC, anon, authenticated;

-- has_role must remain callable by authenticated (RLS policies use it) but not by anon
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
