ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS is_founder_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

UPDATE public.docs
   SET is_founder_only = true,
       role_visibility = ARRAY['admin','founder']
 WHERE category = 'content';

-- Tighten SELECT: founder-only docs require founder/admin regardless of role_visibility overlap.
DROP POLICY IF EXISTS "docs readable by role" ON public.docs;
CREATE POLICY "docs readable by role" ON public.docs
FOR SELECT
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      NOT is_founder_only
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid()
           AND (ur.role)::text = ANY (docs.role_visibility)
      )
    )
    OR (
      is_founder_only
      AND has_role(auth.uid(), 'founder'::app_role)
    )
  )
);