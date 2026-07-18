-- S2: Closer commission model — close-only 10%, set+close 15%, per-user cap
-- Confirmed by owner Jul 10, 2026

-- Per-closer commission cap (nullable; if set, caps their rate regardless of set/close)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_cap_pct numeric;

-- Add set_close rate (15%)
INSERT INTO public.commission_rates (key, label, rate, notes, active)
VALUES ('set_close', 'Set + close (closer)', 0.15, 'Applied when closer both set and closed the deal (setter_id IS NOT NULL)', true)
ON CONFLICT (key) DO UPDATE SET rate = 0.15, label = 'Set + close (closer)', active = true;

-- Rename new_close label to be clearer; keep key for backward compat
UPDATE public.commission_rates SET label = 'Close only', notes = 'Applied when closer closed without a setter' WHERE key = 'new_close';

-- Deactivate legacy closer rates no longer used in new model
UPDATE public.commission_rates SET active = false WHERE key IN ('pif_under_30d', 'payment_plan');
