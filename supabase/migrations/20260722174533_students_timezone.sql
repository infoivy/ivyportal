-- Students are worldwide; CSMs need to know each student's local time before
-- messaging or scheduling (founder-directed 2026-07-22). IANA zone name,
-- auto-captured from the student's own browser in their portal (server fn)
-- and staff-editable as a fallback for unlinked students.
alter table public.students add column timezone text;

comment on column public.students.timezone is
  'IANA timezone (e.g. Europe/London). Auto-synced from the linked student''s browser on portal load; staff-set for unlinked students.';
