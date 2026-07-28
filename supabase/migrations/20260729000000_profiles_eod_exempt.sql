-- Founder-directed 2026-07-29: some team members can be exempted from daily
-- EODs. Admin sets it on Team; every expected-filer surface (home pulse,
-- Performance cards, nudges, digest) skips exempt members. Founder-role
-- accounts are always exempt in app logic regardless of this flag.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS eod_exempt boolean NOT NULL DEFAULT false;
