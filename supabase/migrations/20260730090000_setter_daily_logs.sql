-- Founder-directed 2026-07-30: the setter tracker mirrors his Google Sheet
-- (Daily Setter Log + KPI dashboard + weekly trends + benchmarks). One row
-- per setter per day; setters see and edit ONLY their own tracker,
-- leadership sees everyone's.
CREATE TABLE public.setter_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  inbounds int NOT NULL DEFAULT 0,
  outbounds_sent int NOT NULL DEFAULT 0,
  ib_replies int NOT NULL DEFAULT 0,
  ob_replies int NOT NULL DEFAULT 0,
  follow_ups_sent int NOT NULL DEFAULT 0,
  calls_proposed int NOT NULL DEFAULT 0,
  calendly_sent int NOT NULL DEFAULT 0,
  calls_booked_inbound int NOT NULL DEFAULT 0,
  calls_booked_outbound int NOT NULL DEFAULT 0,
  qualified_bookings int NOT NULL DEFAULT 0,
  unqualified_bookings int NOT NULL DEFAULT 0,
  calls_on_calendar int NOT NULL DEFAULT 0,
  calls_showed int NOT NULL DEFAULT 0,
  sets_closed int NOT NULL DEFAULT 0,
  cash_collected numeric NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
CREATE INDEX setter_daily_logs_user_date_idx ON public.setter_daily_logs (user_id, log_date DESC);

ALTER TABLE public.setter_daily_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.setter_daily_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setter_daily_logs TO authenticated;

CREATE POLICY "Own tracker rows" ON public.setter_daily_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leadership reads every tracker" ON public.setter_daily_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  );
CREATE POLICY "Leadership corrects any tracker" ON public.setter_daily_logs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'cofounder'))
  WITH CHECK (true);

CREATE TRIGGER audit_setter_daily_logs
  AFTER INSERT OR UPDATE OR DELETE ON public.setter_daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
