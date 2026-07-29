-- Portal sweep 2026-07-29 (founder-directed): four seeded knowledge stubs
-- never got content and are retired outright; the Setting Framework Script
-- belongs to students (staff kept opening an empty shell).
DELETE FROM public.docs WHERE slug IN (
  'ga-roadmap',
  'appointment-setting-conversational-flexibility',
  'objection-handling-part-1',
  'objection-handling-part-2'
);
UPDATE public.docs SET role_visibility = ARRAY['student'] WHERE slug = 'setting-framework-script';
