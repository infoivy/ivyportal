-- Bun multi-tenant foundation, PHASE 1 (founder-approved 2026-08-17).
-- Purely ADDITIVE: no existing table, policy, or function behavior changes.
-- Ivy Sales Academy becomes tenant #1; every business row gets an org_id
-- (defaulted, backfilled). Org-scoped RLS cutover is Phase 2, separately.

-- 1. Organizations ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER membership check (also avoids RLS self-recursion on
-- org_members policies).
CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = target_org AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_org_admin(target_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = target_org AND user_id = auth.uid()
      AND roles && ARRAY['owner', 'admin', 'founder']
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS orgs_member_select ON public.orgs;
CREATE POLICY orgs_member_select ON public.orgs
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

DROP POLICY IF EXISTS org_members_visible_to_members ON public.org_members;
CREATE POLICY org_members_visible_to_members ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));

-- 2. Tenant #1: Ivy Sales Academy ------------------------------------------

INSERT INTO public.orgs (name, slug)
SELECT 'Ivy Sales Academy', 'ivy-sales-academy'
WHERE NOT EXISTS (SELECT 1 FROM public.orgs WHERE slug = 'ivy-sales-academy');

-- Default-org helper: the OLDEST org. Legacy writers that do not send
-- org_id keep stamping Ivy until the web app goes org-aware.
CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT id FROM public.orgs ORDER BY created_at LIMIT 1;
$$;

-- Everyone who currently holds any role becomes an Ivy member with those
-- roles (students included, as 'student').
INSERT INTO public.org_members (org_id, user_id, roles)
SELECT public.default_org_id(), user_id, array_agg(DISTINCT role::text)
FROM public.user_roles
GROUP BY user_id
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 3. org_id on the business tables (nullable + defaulted + backfilled;
--    NOT NULL enforcement is Phase 2) ---------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students', 'deals', 'installments', 'eods', 'business_expenses',
    'docs', 'testimonials', 'set_reminders', 'csm_tally',
    'csm_student_notes', 'student_checkins', 'payment_links',
    'invitations', 'org_settings', 'founder_settings', 'commission_rates',
    'kpi_targets', 'payout_confirmations', 'payout_adjustments',
    'wallet_entries', 'team_chat', 'setter_daily_logs', 'role_access'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) DEFAULT public.default_org_id()',
      t);
    EXECUTE format('UPDATE public.%I SET org_id = public.default_org_id() WHERE org_id IS NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (org_id)', t || '_org_id_idx', t);
  END LOOP;
END $$;

-- 4. Self-serve business creation ------------------------------------------

CREATE OR REPLACE FUNCTION public.create_organization(org_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF org_name IS NULL OR length(trim(org_name)) < 2 THEN
    RAISE EXCEPTION 'organization name too short';
  END IF;
  INSERT INTO public.orgs (name, created_by)
  VALUES (trim(org_name), auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.org_members (org_id, user_id, roles)
  VALUES (new_id, auth.uid(), ARRAY['owner', 'admin', 'founder']);
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text) TO authenticated;

-- 5. Org-aware invitations (ADDITIVE policies; existing admin policies
--    keep working unchanged) -------------------------------------------------

DROP POLICY IF EXISTS invitations_org_admin_insert ON public.invitations;
CREATE POLICY invitations_org_admin_insert ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (org_id IS NOT NULL AND public.is_org_admin(org_id));

DROP POLICY IF EXISTS invitations_org_admin_select ON public.invitations;
CREATE POLICY invitations_org_admin_select ON public.invitations
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_admin(org_id));

-- 6. Signup trigger: keep every existing behavior, ADD org enrollment.
--    (Same body as before + org_members inserts on the invite and
--    student-auto-link paths.)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'), (NEW.id, 'founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    SELECT * INTO invite_rec
    FROM public.invitations
    WHERE email = lower(trim(NEW.email))
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      FOREACH role_text IN ARRAY invite_rec.roles
      LOOP
        BEGIN
          INSERT INTO public.user_roles (user_id, role)
          VALUES (NEW.id, role_text::app_role)
          ON CONFLICT (user_id, role) DO NOTHING;
        EXCEPTION WHEN invalid_text_representation THEN
          NULL;
        END;
      END LOOP;

      IF invite_rec.setter_type IS NOT NULL THEN
        UPDATE public.profiles
        SET setter_type = invite_rec.setter_type::text
        WHERE id = NEW.id;
      END IF;

      -- Bun: enroll the invitee in the inviting org.
      INSERT INTO public.org_members (org_id, user_id, roles)
      VALUES (COALESCE(invite_rec.org_id, public.default_org_id()), NEW.id, invite_rec.roles)
      ON CONFLICT (org_id, user_id) DO NOTHING;

      UPDATE public.invitations SET used_at = now() WHERE id = invite_rec.id;
    END IF;
  END IF;

  UPDATE public.students
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND lower(email) = lower(trim(NEW.email));

  IF FOUND THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Bun: linked students join their business's org too.
    INSERT INTO public.org_members (org_id, user_id, roles)
    SELECT COALESCE(s.org_id, public.default_org_id()), NEW.id, ARRAY['student']
    FROM public.students s
    WHERE s.user_id = NEW.id
    LIMIT 1
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
