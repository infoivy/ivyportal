-- Editable setter KPIs (founder 2026-08-06: "allow Abu Bilal to edit the
-- KPIs"). Versioned by effective_from so history is always judged by the
-- rules of its own day — applying a change INSERTS a new row, never edits
-- the past. Static values in src/lib/eod-kpi.ts remain the fallback.
CREATE TABLE public.kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_type text NOT NULL CHECK (setter_type IN ('phone', 'dm', 'full_cycle')),
  effective_from date NOT NULL,
  primary_target int NOT NULL CHECK (primary_target > 0),
  secondary_target int CHECK (secondary_target > 0),
  sets_target int NOT NULL CHECK (sets_target > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setter_type, effective_from)
);
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read KPI targets" ON public.kpi_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leadership manages KPI targets" ON public.kpi_targets
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  );
CREATE TRIGGER audit_kpi_targets
  AFTER INSERT OR UPDATE OR DELETE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- Seed the known history so DB rules reproduce the hardcoded eras exactly.
INSERT INTO public.kpi_targets (setter_type, effective_from, primary_target, secondary_target, sets_target) VALUES
  ('phone', '2000-01-01', 100, NULL, 3),
  ('dm', '2000-01-01', 125, NULL, 3),
  ('dm', '2026-07-29', 300, NULL, 6),
  ('full_cycle', '2000-01-01', 100, 50, 3);
