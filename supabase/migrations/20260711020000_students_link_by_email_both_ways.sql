-- Portal linking must work regardless of ordering:
--  1. signup first, student record later  -> this trigger links on insert/update
--  2. student record first, signup later  -> existing link_student_on_signup trigger
CREATE OR REPLACE FUNCTION public.link_student_record_by_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched uuid;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT id INTO matched FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1;
    IF matched IS NOT NULL THEN
      NEW.user_id := matched;
      INSERT INTO public.user_roles (user_id, role)
      VALUES (matched, 'student')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_student_record_by_email ON public.students;
CREATE TRIGGER link_student_record_by_email
BEFORE INSERT OR UPDATE OF email ON public.students
FOR EACH ROW EXECUTE FUNCTION public.link_student_record_by_email();

-- Backfill: link every unlinked student whose email already has an account
UPDATE public.students s
SET user_id = u.id
FROM auth.users u
WHERE s.user_id IS NULL AND s.email IS NOT NULL AND lower(u.email) = lower(s.email);

INSERT INTO public.user_roles (user_id, role)
SELECT s.user_id, 'student'::public.app_role
FROM public.students s
WHERE s.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
