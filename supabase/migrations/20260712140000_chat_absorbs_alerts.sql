-- Team Chat absorbs the Student Alerts channel: messages can tag a student,
-- and the alert history moves over. student_alerts stays (read-only history)
-- until a later cleanup.
alter table public.team_chat
  add column if not exists student_id uuid references public.students(id) on delete set null;

insert into public.team_chat (body, kind, created_by, created_at, student_id)
select body, 'general', created_by, created_at, student_id
from public.student_alerts;
