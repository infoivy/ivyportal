-- Allow action items assigned to team members without a student.
-- Staff RLS paths are unchanged; the student SELECT path matches on
-- student_id, so team items (student_id IS NULL) stay invisible to students.
ALTER TABLE public.student_action_items ALTER COLUMN student_id DROP NOT NULL;

COMMENT ON COLUMN public.student_action_items.student_id IS
  'Nullable: NULL means the item is an internal team task (see assignee_id).';
