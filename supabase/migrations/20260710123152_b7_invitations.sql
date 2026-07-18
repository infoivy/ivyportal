-- B7: Invite → role auto-apply flow
-- Admins create an invitation (email + roles). When that email signs up,
-- handle_new_user automatically applies the roles from the invitation.

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  setter_type text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations admin full" ON public.invitations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated handle_new_user: checks invitations table by email and auto-assigns roles.
-- Falls back to no roles (admin must assign manually) if no invitation found.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  invite_rec RECORD;
  role_text  text;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT COUNT(*) INTO user_count FROM public.profiles;

  IF user_count = 1 THEN
    -- First account: owner gets admin + founder
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'), (NEW.id, 'founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Check for a valid invitation for this email
    SELECT * INTO invite_rec
    FROM public.invitations
    WHERE email = lower(trim(NEW.email))
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Apply each role from the invitation
      FOREACH role_text IN ARRAY invite_rec.roles
      LOOP
        BEGIN
          INSERT INTO public.user_roles (user_id, role)
          VALUES (NEW.id, role_text::app_role)
          ON CONFLICT (user_id, role) DO NOTHING;
        EXCEPTION WHEN invalid_text_representation THEN
          -- Skip unknown roles silently
          NULL;
        END;
      END LOOP;

      -- Apply setter_type if present
      IF invite_rec.setter_type IS NOT NULL THEN
        UPDATE public.profiles
        SET setter_type = invite_rec.setter_type::text
        WHERE id = NEW.id;
      END IF;

      -- Mark invitation as used
      UPDATE public.invitations SET used_at = now() WHERE id = invite_rec.id;
    END IF;
    -- No invitation = no roles; admin assigns via /team
  END IF;

  RETURN NEW;
END;
$function$;
