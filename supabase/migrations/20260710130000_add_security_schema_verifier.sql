-- Read-only deployment verification for the service-role-only maintenance script.
-- This exposes no application data and is not callable by browser users.
CREATE OR REPLACE FUNCTION public.verify_security_schema()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    (
      SELECT count(*)
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = c.relname
    ) AS policy_count
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.verify_security_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_security_schema() TO service_role;
