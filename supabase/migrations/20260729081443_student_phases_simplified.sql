-- Founder-directed 2026-07-29: the journey is onboarding → training →
-- applying → offer_won (+ paused when needed). "coaching_1on1" made no sense
-- for group students; every row moves to the neutral training phase.
-- uncategorized/testimonial/graduated retire from the UI (testimonial lives
-- on students.testimonial_collected; offer_won is terminal and shows the
-- graduation page). Enum values stay for history; readers stay tolerant.
UPDATE public.students SET phase = 'training' WHERE phase = 'coaching_1on1';
UPDATE public.students SET phase = 'onboarding' WHERE phase = 'uncategorized';
UPDATE public.students SET phase = 'offer_won' WHERE phase IN ('testimonial', 'graduated');
ALTER TABLE public.students ALTER COLUMN phase SET DEFAULT 'onboarding';
