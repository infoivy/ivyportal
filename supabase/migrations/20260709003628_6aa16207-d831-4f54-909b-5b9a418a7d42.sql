
CREATE TABLE public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'google',
  google_email text,
  calendar_id text NOT NULL DEFAULT 'primary',
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  color_hex text NOT NULL DEFAULT '#3b82f6',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Users manage their own connection
CREATE POLICY "Users manage own calendar connection"
  ON public.calendar_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins + closers can see who on the team is connected (to render team calendar)
CREATE POLICY "Admins and closers view team connections"
  ON public.calendar_connections
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'closer'));

CREATE TRIGGER calendar_connections_set_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
