-- "First Appointments" never fit the business (students land setter ROLES,
-- founder-corrected 2026-07-22). Rename in place: progress rows keep their
-- milestone_id, history intact.
UPDATE public.student_milestones
SET name = 'Role Landed',
    description = 'Student has landed their first setter role'
WHERE name = 'First Appointments';
