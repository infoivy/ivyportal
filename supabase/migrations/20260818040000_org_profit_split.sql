-- Profit split becomes a per-org setting (founder-directed 2026-08-18).
--
-- The web Finance page carries the split as a hardcoded constant with three
-- real names in it, which cannot ship in a multi-tenant product: every other
-- business signing up to Bun would see Ivy's partners. This moves it onto the
-- org itself. Purely additive — the web page keeps working off its constant
-- until it is pointed at this column.

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS profit_split jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orgs.profit_split IS
  'Array of {name, pct} rows. Percentages of profit after expenses and team payouts.';

-- Orgs had SELECT only; an owner/admin/founder of the org may now edit its
-- settings. Membership and role are checked by the existing SECURITY DEFINER
-- helper, so this cannot be widened by a client.
DROP POLICY IF EXISTS orgs_admin_update ON public.orgs;
CREATE POLICY orgs_admin_update ON public.orgs
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- Seed tenant #1 with the split the business already runs on. Only when it is
-- still empty, so re-running never overwrites an edit made in the app.
UPDATE public.orgs
SET profit_split = '[
  {"name": "Abdulrahmane", "pct": 70},
  {"name": "Faizan", "pct": 15},
  {"name": "Abu Bilal", "pct": 15}
]'::jsonb
WHERE slug = 'ivy-sales-academy'
  AND profit_split = '[]'::jsonb;
