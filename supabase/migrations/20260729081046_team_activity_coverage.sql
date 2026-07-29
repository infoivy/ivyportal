-- Founder-directed 2026-07-29: every portal action lands in one log with a
-- timestamp so Team admin shows who is active. audit_log + write_audit_log
-- already existed (deals, user_roles, commission_rates); this hardens the
-- trigger (skip no-change updates and demo rows) and extends coverage to
-- the operational tables. Triggers log regardless of which code path wrote.

CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN
    RETURN NEW; -- no-op update: nothing happened, log nothing
  END IF;
  rec := CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF (rec ? 'is_demo') AND coalesce((rec->>'is_demo')::boolean, false) THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END; -- demo rows stay out
  END IF;
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students', 'student_action_items', 'student_calls', 'eods',
    'installments', 'installment_payments', 'business_expenses',
    'payout_confirmations'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()',
      t, t
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_created_idx ON public.audit_log (user_id, created_at DESC);

-- Last activity per member for the "who's active" line (inherits the
-- admin-only RLS of audit_log through the invoker view).
CREATE OR REPLACE VIEW public.team_last_activity
WITH (security_invoker = on) AS
SELECT user_id AS actor_id, max(created_at) AS last_at
FROM public.audit_log
WHERE user_id IS NOT NULL
GROUP BY user_id;
GRANT SELECT ON public.team_last_activity TO authenticated;
