
-- Extend student_calls with structured status/rating/action items
ALTER TABLE public.student_calls
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS progress_rating int,
  ADD COLUMN IF NOT EXISTS duration_min int,
  ADD COLUMN IF NOT EXISTS action_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_call_date date;

ALTER TABLE public.student_calls DROP CONSTRAINT IF EXISTS student_calls_status_check;
ALTER TABLE public.student_calls ADD CONSTRAINT student_calls_status_check
  CHECK (status IN ('scheduled','completed','no_show','follow_up','cancelled'));

ALTER TABLE public.student_calls DROP CONSTRAINT IF EXISTS student_calls_rating_check;
ALTER TABLE public.student_calls ADD CONSTRAINT student_calls_rating_check
  CHECK (progress_rating IS NULL OR (progress_rating >= 1 AND progress_rating <= 5));

-- Profile: avatar file path (for Storage) + active flag for deactivation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Storage RLS for avatars bucket (bucket itself is created via storage tool)
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
