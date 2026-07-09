
-- Category enum
CREATE TYPE public.doc_category AS ENUM ('setting','closing','csm','coaching','team_ops','onboarding','content');
CREATE TYPE public.payment_method AS ENUM ('whop','stripe','wise','paypal','bank','other');

-- docs
CREATE TABLE public.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category public.doc_category NOT NULL,
  content text NOT NULL DEFAULT '',
  role_visibility text[] NOT NULL DEFAULT ARRAY['admin']::text[],
  sort_order int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated;
GRANT ALL ON public.docs TO service_role;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs readable by role" ON public.docs
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = ANY (public.docs.role_visibility)
  )
);

CREATE POLICY "docs admin insert" ON public.docs
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "docs admin update" ON public.docs
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "docs admin delete" ON public.docs
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER docs_set_updated_at
BEFORE UPDATE ON public.docs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX docs_category_idx ON public.docs(category);
CREATE INDEX docs_updated_at_idx ON public.docs(updated_at DESC);

-- payment_links
CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric(12,2),
  url text NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'stripe',
  notes text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_links read closers admins" ON public.payment_links
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'closer')
);

CREATE POLICY "payment_links admin insert" ON public.payment_links
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "payment_links admin update" ON public.payment_links
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "payment_links admin delete" ON public.payment_links
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payment_links_set_updated_at
BEFORE UPDATE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
