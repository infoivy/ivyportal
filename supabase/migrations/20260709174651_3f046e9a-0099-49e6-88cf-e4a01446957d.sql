CREATE TABLE public.crm_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  lead_name text,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_lead_notes_lead_id_idx ON public.crm_lead_notes(lead_id);
CREATE INDEX crm_lead_notes_created_at_idx ON public.crm_lead_notes(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_notes TO authenticated;
GRANT ALL ON public.crm_lead_notes TO service_role;

ALTER TABLE public.crm_lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read all lead notes"
ON public.crm_lead_notes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'closer')
  OR public.has_role(auth.uid(), 'setter')
  OR public.has_role(auth.uid(), 'coach')
  OR public.has_role(auth.uid(), 'csm')
);

CREATE POLICY "Team members can create lead notes"
ON public.crm_lead_notes FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'closer')
    OR public.has_role(auth.uid(), 'setter')
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'csm')
  )
);

CREATE POLICY "Authors and admins can update lead notes"
ON public.crm_lead_notes FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete lead notes"
ON public.crm_lead_notes FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER crm_lead_notes_updated_at
BEFORE UPDATE ON public.crm_lead_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();