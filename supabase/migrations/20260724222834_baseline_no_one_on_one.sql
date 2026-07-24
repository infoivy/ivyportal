-- Baseline is NO 1:1 calls (founder-directed 2026-07-25): a student only
-- gets a 1:1 allotment through payment setup (1:1 Pathway package) or the
-- staff Program chip. The old column defaults (10) meant every skip-for-now
-- approval silently minted a 1:1 student.
ALTER TABLE public.students ALTER COLUMN calls_included SET DEFAULT 0;
ALTER TABLE public.students ALTER COLUMN calls_allotted SET DEFAULT 0;

-- Existing rows that only ever had the default: no deal, no payment state,
-- calls untouched at 10/10. Real 1:1 students (deal logged, payment set, or
-- staff-adjusted allotments) are left alone.
UPDATE public.students s
SET calls_included = 0, calls_allotted = 0
WHERE s.calls_allotted = 10 AND s.calls_included = 10
  AND s.payment_state IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.student_id = s.id);
