
-- Onboarding templates: per-role ordered step list
CREATE TABLE public.onboarding_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id, label, kind: 'doc'|'video'|'action'|'link', target, note}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in reads templates"
  ON public.onboarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates"
  ON public.onboarding_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user completion of individual steps
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  step_id TEXT NOT NULL,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, step_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_progress TO service_role;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own progress"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users mark own progress"
  ON public.onboarding_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users clear own progress"
  ON public.onboarding_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins see all progress"
  ON public.onboarding_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default templates for known roles
INSERT INTO public.onboarding_templates (role, title, description, steps) VALUES
('setter', 'Setter — Start Here', 'Get up and running as an appointment setter in your first day.', '[
  {"id":"read-setter-sop","label":"Read the Setter SOP","kind":"doc","target":"/sops/isa-setting-process"},
  {"id":"read-crm-hygiene","label":"Read CRM Hygiene policy","kind":"doc","target":"/policies/crm-hygiene"},
  {"id":"watch-training","label":"Watch onboarding training videos","kind":"video","target":"/training"},
  {"id":"set-profile","label":"Complete your profile (photo, display name)","kind":"action","target":"/profile"},
  {"id":"first-eod","label":"Submit your first EOD","kind":"action","target":"/eods"},
  {"id":"bookmark-dashboard","label":"Bookmark your dashboard","kind":"action","target":"/dashboard"}
]'::jsonb),
('closer', 'Closer — Start Here', 'Ramp up as a closer.', '[
  {"id":"read-closer-resources","label":"Review Closer Resources","kind":"doc","target":"/closer-resources"},
  {"id":"read-crm-hygiene","label":"Read CRM Hygiene policy","kind":"doc","target":"/policies/crm-hygiene"},
  {"id":"watch-training","label":"Watch closer training videos","kind":"video","target":"/training"},
  {"id":"set-profile","label":"Complete your profile","kind":"action","target":"/profile"},
  {"id":"first-eod","label":"Submit your first EOD","kind":"action","target":"/eods"},
  {"id":"first-deal","label":"Log a test deal in /revenue","kind":"action","target":"/revenue"}
]'::jsonb),
('coach', 'Coach — Start Here', 'Onboard as a coach.', '[
  {"id":"read-policies","label":"Read team policies","kind":"doc","target":"/policies"},
  {"id":"watch-training","label":"Watch coach training","kind":"video","target":"/training"},
  {"id":"set-profile","label":"Complete your profile","kind":"action","target":"/profile"},
  {"id":"review-students","label":"Review your assigned students","kind":"action","target":"/students"},
  {"id":"first-call","label":"Log your first 1:1 call","kind":"action","target":"/calls"}
]'::jsonb),
('csm', 'CSM — Start Here', 'Onboard as a CSM.', '[
  {"id":"read-policies","label":"Read team policies","kind":"doc","target":"/policies"},
  {"id":"watch-training","label":"Watch CSM training","kind":"video","target":"/training"},
  {"id":"set-profile","label":"Complete your profile","kind":"action","target":"/profile"},
  {"id":"first-checkin","label":"Log your first daily tally","kind":"action","target":"/csm"},
  {"id":"first-eod","label":"Submit your first EOD","kind":"action","target":"/eods"}
]'::jsonb);
