-- New student journey: onboarding (training videos) → 1:1 coaching → applying
-- (role finding) → offer_won → testimonial. Old 'training'/'graduated' values
-- stay in the enum (Postgres can't drop enum values) but are remapped and no
-- longer offered in the UI.
alter type public.student_phase add value if not exists 'applying';
alter type public.student_phase add value if not exists 'offer_won';
alter type public.student_phase add value if not exists 'testimonial';
