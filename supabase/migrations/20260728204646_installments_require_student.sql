-- A plan without a student row is invisible to EVERY money surface (all
-- readers join students for the demo filter): the Adem Fadil plan became an
-- unreachable ghost when his student row was deleted (FK was SET NULL), and
-- the editor's "enter name manually" path created such ghosts directly.
-- Ghost cleaned 2026-07-28. From now on: plans REQUIRE a student, and
-- deleting a student with a plan fails loudly (delete the plan first on
-- Money in) instead of detaching money rows into the void.
ALTER TABLE public.installments ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE public.installments DROP CONSTRAINT installments_student_id_fkey;
ALTER TABLE public.installments ADD CONSTRAINT installments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
