-- Scholarship students are placed for free: no deal, no installments, but the
-- payment step must not block. New enum value keeps them distinguishable from
-- paid_in_full so revenue stays honest.
ALTER TYPE public.payment_state ADD VALUE IF NOT EXISTS 'scholarship';
