
-- Trigger-only functions: revoke EXECUTE from PUBLIC and roles entirely.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_student_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.testimonial_sync_student_flags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Helper functions: block anon; keep authenticated where callers need it.
-- has_role is referenced by RLS policies and must remain callable by authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- student_toggle_action_item is called by signed-in students only.
REVOKE EXECUTE ON FUNCTION public.student_toggle_action_item(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_toggle_action_item(uuid, integer, boolean) TO authenticated;

-- Avatars storage policy: replace public SELECT with authenticated-only.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars readable by authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
