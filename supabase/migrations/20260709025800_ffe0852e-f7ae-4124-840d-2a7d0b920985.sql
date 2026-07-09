
DO $$ BEGIN
  CREATE TYPE public.payment_state AS ENUM ('paid_in_full','installments','behind');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_grade TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS calls_allotted INT NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS payment_state public.payment_state,
  ADD COLUMN IF NOT EXISTS first_win_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offers_landed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_landed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS testimonial_collected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trustpilot_collected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS general_notes TEXT;
