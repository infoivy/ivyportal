CREATE TABLE public.student_action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  assignee_id uuid,
  text text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamp with time zone,
  source_call_id uuid REFERENCES public.student_calls(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX student_action_items_student_id_idx ON public.student_action_items(student_id);
CREATE INDEX student_action_items_created_by_idx ON public.student_action_items(created_by);
CREATE INDEX student_action_items_done_due_idx ON public.student_action_items(done, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_action_items TO authenticated;
GRANT ALL ON public.student_action_items TO service_role;

ALTER TABLE public.student_action_items ENABLE ROW LEVEL SECURITY;

-- Staff (admin, coach, csm, closer, setter) can view all items
CREATE POLICY "Staff can view all action items"
  ON public.student_action_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'csm')
    OR public.has_role(auth.uid(), 'closer')
    OR public.has_role(auth.uid(), 'setter')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

-- Staff can insert
CREATE POLICY "Staff can insert action items"
  ON public.student_action_items FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coach')
      OR public.has_role(auth.uid(), 'csm')
      OR public.has_role(auth.uid(), 'closer')
      OR public.has_role(auth.uid(), 'setter')
    )
  );

-- Item creator, any staff, or the student themselves can update (student only toggles done)
CREATE POLICY "Creator or staff or student can update action items"
  ON public.student_action_items FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coach')
    OR public.has_role(auth.uid(), 'csm')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

-- Only creator or admin can delete
CREATE POLICY "Creator or admin can delete action items"
  ON public.student_action_items FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER student_action_items_set_updated_at
  BEFORE UPDATE ON public.student_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();