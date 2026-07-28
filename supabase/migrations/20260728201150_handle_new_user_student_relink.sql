-- Deleted-account re-signups dead-ended on "Application pending":
-- students.user_id is ON DELETE SET NULL and nothing ever relinked the
-- student row to the new auth account (founder hit this with a test account,
-- 2026-07-28). Redefine handle_new_user to auto-relink any unlinked student
-- row matching the new email (case-insensitive) and re-grant the student
-- role on match. Invitation logic unchanged from b7_invitations.

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

  -- Auto-relink: a student row left unlinked (created before the account
  -- existed, or orphaned when a previous account was deleted) claims this
  -- signup by email. Never touches rows already linked to a live account.
  UPDATE public.students
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND lower(email) = lower(trim(NEW.email));

  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
