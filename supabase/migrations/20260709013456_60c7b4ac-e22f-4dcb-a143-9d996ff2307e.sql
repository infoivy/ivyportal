
-- 1. Extend app_role enum with coach + student
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';

-- 2. Student enums
DO $$ BEGIN
  CREATE TYPE public.student_phase AS ENUM ('uncategorized','onboarding','coaching_1on1','training','graduated','paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.student_status AS ENUM ('active','inactive','ghosting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Students
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phase public.student_phase NOT NULL DEFAULT 'uncategorized',
  status public.student_status NOT NULL DEFAULT 'active',
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls_included INT NOT NULL DEFAULT 4,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Team can view all students" ON public.students FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'closer')
      OR public.has_role(auth.uid(),'setter')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student views own record" ON public.students FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins/coaches insert students" ON public.students FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins/coaches update students" ON public.students FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins delete students" ON public.students FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_students_updated_at ON public.students;
CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Student 1-on-1 calls
CREATE TABLE IF NOT EXISTS public.student_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_date DATE NOT NULL,
  fathom_url TEXT,
  action_items TEXT,
  coach_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_calls TO authenticated;
GRANT ALL ON public.student_calls TO service_role;
ALTER TABLE public.student_calls ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Team view student calls" ON public.student_calls FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'closer')
      OR public.has_role(auth.uid(),'setter')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student view own calls" ON public.student_calls FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_calls.student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches/admins insert calls" ON public.student_calls FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches/admins update calls" ON public.student_calls FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches/admins delete calls" ON public.student_calls FOR DELETE TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_student_calls_updated_at ON public.student_calls;
CREATE TRIGGER set_student_calls_updated_at
  BEFORE UPDATE ON public.student_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Student EODs
CREATE TABLE IF NOT EXISTS public.student_eods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  applications_submitted INT NOT NULL DEFAULT 0,
  outreach_sent INT NOT NULL DEFAULT 0,
  replies INT NOT NULL DEFAULT 0,
  interviews INT NOT NULL DEFAULT 0,
  wins TEXT,
  blockers TEXT,
  tomorrow_focus TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, report_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_eods TO authenticated;
GRANT ALL ON public.student_eods TO service_role;
ALTER TABLE public.student_eods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Team view student eods" ON public.student_eods FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'closer')
      OR public.has_role(auth.uid(),'setter')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student view own eods" ON public.student_eods FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_eods.student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student insert own eods" ON public.student_eods FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_eods.student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student update own eods" ON public.student_eods FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_eods.student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Student delete own eods" ON public.student_eods FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_eods.student_id AND s.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins/coaches manage student eods" ON public.student_eods FOR ALL TO authenticated
    USING (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    )
    WITH CHECK (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'coach')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_student_eods_updated_at ON public.student_eods;
CREATE TRIGGER set_student_eods_updated_at
  BEFORE UPDATE ON public.student_eods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Auto-link student to their auth user + assign student role on signup
CREATE OR REPLACE FUNCTION public.link_student_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched BOOLEAN := false;
BEGIN
  UPDATE public.students
     SET user_id = NEW.id
   WHERE lower(email) = lower(NEW.email)
     AND user_id IS NULL;
  GET DIAGNOSTICS matched = ROW_COUNT;
  IF matched THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_link_student ON auth.users;
CREATE TRIGGER on_auth_user_link_student
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_student_on_signup();

-- 7. QoL: setters delete own EODs
DO $$ BEGIN
  CREATE POLICY "Users delete own eods" ON public.eods FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. QoL: admins update any profile (for avatar/display name changes)
DO $$ BEGIN
  CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(),'admin'))
    WITH CHECK (public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
