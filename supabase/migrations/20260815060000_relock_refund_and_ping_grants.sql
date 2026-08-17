-- Security lint follow-up (2026-08-15): CREATE OR REPLACE of
-- refund_student_money in 20260731100249 (the p_archive variant) reset the
-- default EXECUTE grants that 20260728204825 had locked down, and
-- portal_ping shipped with defaults. Both gate internally via has_role /
-- auth.uid(), but anon must not be able to invoke SECURITY DEFINER money
-- paths at all (defense in depth, same pattern as the earlier lock).
REVOKE ALL ON FUNCTION public.refund_student_money(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_student_money(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_ping(date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_student_money(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_student_money(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_ping(date, boolean) TO authenticated, service_role;
