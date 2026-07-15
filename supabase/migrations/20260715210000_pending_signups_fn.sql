-- Approvers (admin/closer/csm/founder/cofounder) need the pending-signup
-- queue, but plain closers/CSMs cannot read other users' user_roles rows
-- under RLS, so the client-side "profiles minus placed" computation showed
-- every account as pending. This narrow SECURITY DEFINER function returns
-- exactly the queue without widening role visibility.
CREATE OR REPLACE FUNCTION public.pending_signups()
RETURNS TABLE (id uuid, display_name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.created_at
  FROM public.profiles p
  WHERE (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'closer'::public.app_role)
      OR public.has_role(auth.uid(), 'csm'::public.app_role)
      OR public.has_role(auth.uid(), 'founder'::public.app_role)
      OR public.has_role(auth.uid(), 'cofounder'::public.app_role)
    )
    AND p.active IS DISTINCT FROM false
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.pending_signups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_signups() TO authenticated, service_role;
