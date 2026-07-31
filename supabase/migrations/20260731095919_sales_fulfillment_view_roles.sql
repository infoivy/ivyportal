-- Founder 2026-07-31: the department home views are ROLE-driven, not
-- profile-driven, so a new appointee (or the founder's preview account)
-- gets a view by role grant. 'sales' and 'fulfillment' are view-only
-- roles: every permission/EOD/nav rule scopes to the original roles, so
-- these grant nothing but the home picture.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fulfillment';
ALTER TABLE public.profiles DROP COLUMN IF EXISTS home_focus;
