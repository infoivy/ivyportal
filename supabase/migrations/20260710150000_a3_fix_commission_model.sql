-- A3: Fix setter commission model
-- Business rules confirmed by owner (Jul 10, 2026):
--   - Setter base rate: 7.5% of cash_collected_upfront (not total_value)
--   - Only bonus: setter who collects ≥$5,000 cash in a Mon–Sun week gets +1% for that payout period
--   - NO PIF bonus for setters (label was wrong, logic was wrong)

-- Upsert setter_base at 7.5%
INSERT INTO public.commission_rates (key, label, rate, notes, active)
VALUES ('setter_base', 'Setter base', 0.075, 'Applied to cash collected upfront per deal', true)
ON CONFLICT (key) DO UPDATE SET rate = 0.075, label = 'Setter base', active = true;

-- Remove the incorrectly-named PIF bonus row if it exists
DELETE FROM public.commission_rates WHERE key = 'setter_pif_bonus';
