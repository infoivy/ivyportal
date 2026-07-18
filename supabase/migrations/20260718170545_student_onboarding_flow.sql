-- Student onboarding flow (founder-directed 2026-07-18):
--  1. Weekly EOD records WHICH group calls were attended (names, no times —
--     times differ per student timezone) plus self-reported 1:1 calls, so lazy
--     bookers surface. group_calls_attended stays as the derived count so
--     existing staff readers keep working; historical rows keep count-only.
--  2. The seven weekly group-call names live in org_settings (admin-editable);
--     seeded from the Skool calendar.
--  3. New students are locked to Start Here until every onboarding step is
--     done; completion stamps onboarding_completed_at. Existing students are
--     backfilled complete so nobody currently active gets locked out.

alter table public.student_weekly_eods
  add column calls_attended jsonb not null default '[]'::jsonb,
  add column one_on_one_calls smallint,
  add constraint student_weekly_eods_one_on_one_range
    check (one_on_one_calls is null or one_on_one_calls between 0 and 20);

comment on column public.student_weekly_eods.calls_attended is
  'Array of {day, name} for each weekly group call the student attended. group_calls_attended mirrors its length; legacy rows keep [] with a count only.';
comment on column public.student_weekly_eods.one_on_one_calls is
  'Self-reported 1:1 coaching calls that week (1:1 pathway students only — they have a limited allotment and some sit on it).';

alter table public.org_settings
  add column group_call_schedule jsonb not null default '[
    {"day": "Mon", "name": "Off Call Drills"},
    {"day": "Tue", "name": "Role Finding"},
    {"day": "Wed", "name": "Roleplays"},
    {"day": "Thu", "name": "Script Review"},
    {"day": "Fri", "name": "Setting Masterclass"},
    {"day": "Sat", "name": "Call Review"},
    {"day": "Sun", "name": "Roleplays"}
  ]'::jsonb;

comment on column public.org_settings.group_call_schedule is
  'The seven weekly group coaching calls, one per weekday, names only. Shown as the weekly-EOD attendance checklist.';

alter table public.students
  add column onboarding_completed_at timestamptz;

comment on column public.students.onboarding_completed_at is
  'When the student finished every Start Here step. NULL locks their portal to Start Here only. Set by the completion server fn or a staff override.';

-- Everyone already in the program keeps full access.
update public.students set onboarding_completed_at = created_at;
