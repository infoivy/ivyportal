-- Docs can embed an external file (Google Doc preview, PDF, Loom) instead of
-- imported text. The founder wants the Setting Framework script shown as the
-- live Google Doc, not extracted markdown (2026-07-28).
alter table public.docs add column embed_url text;
