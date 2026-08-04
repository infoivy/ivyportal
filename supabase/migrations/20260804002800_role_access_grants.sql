-- Access defaults become a full grid (founder 2026-08-04): admins can now
-- GRANT pages beyond a role's defaults, not only hide defaults. Server/route
-- role walls still cap what a grant can do; this stays a visibility layer.
ALTER TABLE public.role_access ADD COLUMN granted_pages text[] NOT NULL DEFAULT '{}';
