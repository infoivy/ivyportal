-- Remap legacy phases onto the new journey (separate migration: new enum
-- values can't be used in the transaction that added them).
update public.students set phase = 'onboarding' where phase = 'training';
update public.students set phase = 'offer_won' where phase = 'graduated';
