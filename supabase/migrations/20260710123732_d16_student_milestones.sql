-- D16: Student progress milestones
-- D17: Testimonial pipeline — auto-action-item on First Close

CREATE TABLE public.student_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_milestone_progress (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.student_milestones(id) ON DELETE CASCADE,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  achieved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (student_id, milestone_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_milestones TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.student_milestone_progress TO authenticated;
GRANT ALL ON public.student_milestones TO service_role;
GRANT ALL ON public.student_milestone_progress TO service_role;

ALTER TABLE public.student_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_milestone_progress ENABLE ROW LEVEL SECURITY;

-- All staff can read milestones; admins can manage
CREATE POLICY "milestones staff read" ON public.student_milestones
FOR SELECT TO authenticated USING (true);

CREATE POLICY "milestones admin write" ON public.student_milestones
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff can read and mark progress
CREATE POLICY "milestone_progress staff read" ON public.student_milestone_progress
FOR SELECT TO authenticated USING (true);

CREATE POLICY "milestone_progress staff insert" ON public.student_milestone_progress
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'coach') OR
  public.has_role(auth.uid(), 'csm')
);

CREATE POLICY "milestone_progress admin delete" ON public.student_milestone_progress
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Seed default milestones
INSERT INTO public.student_milestones (name, description, sort_order) VALUES
  ('Onboarded',               'Student has joined and completed initial onboarding steps', 0),
  ('First Appointments',      'Student has booked their first job interviews or appointments', 1),
  ('First Close',             'Student has landed their first client or closed their first deal', 2),
  ('Case Study Ready',        'Student has a result strong enough for a case study or testimonial', 3)
ON CONFLICT DO NOTHING;

-- D17: when First Close milestone is marked, auto-create a testimonial action item
CREATE OR REPLACE FUNCTION public.handle_first_close_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  milestone_name text;
  student_name text;
BEGIN
  SELECT name INTO milestone_name FROM public.student_milestones WHERE id = NEW.milestone_id;
  IF milestone_name = 'First Close' THEN
    SELECT full_name INTO student_name FROM public.students WHERE id = NEW.student_id;
    INSERT INTO public.student_action_items (student_id, text, done, created_by)
    VALUES (
      NEW.student_id,
      'Request testimonial from ' || COALESCE(student_name, 'student') || ' — first close achieved!',
      false,
      COALESCE(NEW.achieved_by, auth.uid())
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_first_close_milestone
AFTER INSERT ON public.student_milestone_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_first_close_milestone();
