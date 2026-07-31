-- write_audit_log assumed every audited table has an "id" column; tables
-- with composite keys (payout_confirmations: period_start+user_id,
-- user_roles: user_id+role) crashed EVERY write since the triggers landed,
-- which silently broke the Mark paid flow and role grants. Derive the
-- record id from the row json instead, falling back to the composite parts.
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec jsonb;
  rid text;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
    RETURN NEW; -- no-op update: nothing happened, log nothing
  END IF;
  rec := CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF (rec ? 'is_demo') AND coalesce((rec->>'is_demo')::boolean, false) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END; -- demo rows stay out
  END IF;
  rid := coalesce(
    rec->>'id',
    nullif(concat_ws(':', rec->>'period_start', rec->>'user_id', rec->>'role'), ''),
    'unknown'
  );
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    rid,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
