-- Founder 2026-07-31: card entries shouldn't demand an essay. One character
-- is enough; the UI offers spend categories so most entries need no typing.
ALTER TABLE public.wallet_entries DROP CONSTRAINT wallet_entries_note_check;
ALTER TABLE public.wallet_entries ADD CONSTRAINT wallet_entries_note_check CHECK (length(trim(note)) >= 1);
