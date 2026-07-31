-- Refund propagation + payout ledger adjustments (founder 2026-07-31).
-- 1) Paid installment payments can now be refunded (they stop counting
--    toward cash and commissions everywhere; readers count 'paid' only).
ALTER TYPE public.installment_payment_status ADD VALUE IF NOT EXISTS 'refunded';

-- 2) Manual payout adjustments: signed line items on a member's semi-monthly
--    payout (corrections, off-system payments). Note is mandatory.
CREATE TABLE public.payout_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  amount numeric NOT NULL CHECK (amount <> 0 AND abs(amount) <= 100000),
  note text NOT NULL CHECK (length(trim(note)) >= 3),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payout_adjustments_period_idx ON public.payout_adjustments (period_start, user_id);
ALTER TABLE public.payout_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payout admins manage adjustments" ON public.payout_adjustments
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  );
CREATE TRIGGER audit_payout_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.payout_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- 3) Confirmations can carry a note (what was actually paid and why).
ALTER TABLE public.payout_confirmations ADD COLUMN IF NOT EXISTS note text;

-- 4) One-shot refund: void every active deal and plan for a student, waive
--    unpaid installments, flip paid ones to refunded. Deals with a NULL
--    student_id fall back to an exact name match so legacy rows are caught.
CREATE OR REPLACE FUNCTION public.refund_student_money(p_student_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_student_name text;
  v_deals int := 0;
  v_deals_cash numeric := 0;
  v_plans int := 0;
  v_paid int := 0;
  v_paid_cash numeric := 0;
  v_waived int := 0;
begin
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'closer')) then
    raise exception 'Forbidden: money operator access required';
  end if;
  if length(v_reason) < 3 then
    raise exception 'A refund reason is required';
  end if;
  select full_name into v_student_name from public.students where id = p_student_id;
  if v_student_name is null then
    raise exception 'Student not found';
  end if;

  with d as (
    update public.deals
      set voided_at = now(), voided_by = auth.uid(), void_reason = 'Refund: ' || v_reason
      where voided_at is null
        and (student_id = p_student_id
             or (student_id is null and lower(trim(student_name)) = lower(trim(v_student_name))))
      returning coalesce(cash_collected_upfront, 0) as cash
  )
  select count(*), coalesce(sum(cash), 0) into v_deals, v_deals_cash from d;

  with pp as (
    update public.installment_payments ip
      set status = 'refunded',
          paid_at = null,
          notes = concat_ws(E'\n', nullif(ip.notes, ''),
            'Refunded ' || to_char(now(), 'YYYY-MM-DD')
            || ' (originally paid ' || coalesce(to_char(ip.paid_at, 'YYYY-MM-DD'), 'unknown') || '): '
            || v_reason)
      from public.installments i
      where ip.installment_id = i.id
        and i.student_id = p_student_id
        and ip.status = 'paid'
      returning ip.amount
  )
  select count(*), coalesce(sum(amount), 0) into v_paid, v_paid_cash from pp;

  with pw as (
    update public.installment_payments ip
      set status = 'waived',
          notes = concat_ws(E'\n', nullif(ip.notes, ''), 'Waived on refund: ' || v_reason)
      from public.installments i
      where ip.installment_id = i.id
        and i.student_id = p_student_id
        and ip.status in ('upcoming', 'late', 'missed')
      returning 1
  )
  select count(*) into v_waived from pw;

  update public.installments
    set voided_at = now(), voided_by = auth.uid(), void_reason = 'Refund: ' || v_reason
    where student_id = p_student_id and voided_at is null;
  get diagnostics v_plans = row_count;

  return jsonb_build_object(
    'deals', v_deals,
    'deals_cash', v_deals_cash,
    'plans', v_plans,
    'paid_payments', v_paid,
    'paid_cash', v_paid_cash,
    'waived', v_waived
  );
end;
$$;
