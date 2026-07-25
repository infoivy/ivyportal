-- Post-unlock portal walkthrough (founder-directed 2026-07-25): after Start
-- Here, 1:1 students see the founder's Loom walkthrough at the top of their
-- portal; everything else is visible but soft-locked until they mark it
-- watched. started/done timestamps let staff spot a 12-minute video "watched"
-- in 40 seconds. Deliberately NOT part of Start Here — the point is scrolling
-- the real portal while he narrates it.
alter table public.students
  add column walkthrough_started_at timestamptz,
  add column walkthrough_done_at timestamptz;

comment on column public.students.walkthrough_done_at is
  'When the student marked the post-unlock portal walkthrough Loom as fully watched. NULL soft-locks the portal (visible, not interactive). Group-pathway students gate on their own video once one exists.';
