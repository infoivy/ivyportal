-- Upcoming sets with reminder tracking. A row is created when a setter logs
-- a set or claims a team-calendar event as theirs; the Google Calendar event
-- carries the actual reminders (2d / 1d / 3h / 1h before).
CREATE TABLE public.set_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect text NOT NULL,
  event_start timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','claimed','calendly')),
  gcal_event_id text,
  gcal_html_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.set_reminders TO authenticated;
GRANT ALL ON public.set_reminders TO service_role;
ALTER TABLE public.set_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales staff view set reminders" ON public.set_reminders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'setter') OR public.has_role(auth.uid(), 'closer')
  );

CREATE POLICY "Staff insert own set reminders" ON public.set_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder')
      OR public.has_role(auth.uid(), 'setter') OR public.has_role(auth.uid(), 'closer')
    )
  );

CREATE POLICY "Owner or admin manage set reminders" ON public.set_reminders
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_set_reminders_start ON public.set_reminders(event_start);
CREATE INDEX idx_set_reminders_owner ON public.set_reminders(owner_id);
