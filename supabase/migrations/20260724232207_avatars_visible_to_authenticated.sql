-- Avatars are profile pictures rendered across the whole portal, but SELECT
-- was own-folder-or-admin only — so non-admin staff never saw teammates'
-- avatars and students could never see their coach's (founder-directed
-- 2026-07-25: show the coach's picture). Viewing opens to all signed-in
-- users; upload/update/delete stay owner-or-admin.
DROP POLICY "Users can view their own avatar" ON storage.objects;
CREATE POLICY "Authenticated users view avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
