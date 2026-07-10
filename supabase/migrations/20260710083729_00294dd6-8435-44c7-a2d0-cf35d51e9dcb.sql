
-- 1) Avatars bucket: restrict SELECT to owner (or admin). Replaces broad authenticated-read policy.
DROP POLICY IF EXISTS "Avatars readable by authenticated users" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 2) csm_student_notes: tighten UPDATE WITH CHECK to prevent non-admins from reassigning user_id.
DROP POLICY IF EXISTS "Users update own csm notes and admins update all" ON public.csm_student_notes;
CREATE POLICY "Users update own csm notes and admins update all"
ON public.csm_student_notes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  -- Non-admins can only leave user_id equal to their own; admins may set any user_id.
  (user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3) csm_tally: add matching WITH CHECK on UPDATE.
DROP POLICY IF EXISTS "Owner or admin update csm_tally" ON public.csm_tally;
CREATE POLICY "Owner or admin update csm_tally"
ON public.csm_tally
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4) deals: prevent non-admins from reassigning created_by or closer_id via UPDATE.
CREATE OR REPLACE FUNCTION public.deals_prevent_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Only admins can reassign a deal creator';
  END IF;
  IF NEW.closer_id IS DISTINCT FROM OLD.closer_id THEN
    RAISE EXCEPTION 'Only admins can reassign a deal to a different closer';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deals_prevent_reassignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS deals_prevent_reassignment_tr ON public.deals;
CREATE TRIGGER deals_prevent_reassignment_tr
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.deals_prevent_reassignment();

-- 5) Reduce SECURITY DEFINER exposure. Trigger-only helpers do not need PUBLIC/authenticated EXECUTE.
--    has_role and student_toggle_action_item remain callable by authenticated because:
--      * has_role is invoked from RLS policies and must be executable by the querying role;
--        it is the Supabase-recommended pattern to avoid RLS recursion.
--      * student_toggle_action_item validates ownership internally (raises when auth.uid()
--        does not own the row) before performing the update.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.testimonial_sync_student_flags() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_student_on_signup() FROM PUBLIC;
