-- Founder 2026-07-31 ("Adem is still in the students list"): a refunded or
-- removed student must leave every roster in ONE move, without deleting the
-- money history their voided records still reference. archived_at is the
-- universal "gone from lists" flag; refunds set it by default.
ALTER TABLE public.students ADD COLUMN archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.refund_student_money(p_student_id uuid, p_reason text, p_archive boolean DEFAULT true)
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

  if p_archive then
    update public.students
      set archived_at = now(), status = 'inactive'
      where id = p_student_id and archived_at is null;
  end if;

  return jsonb_build_object(
    'deals', v_deals,
    'deals_cash', v_deals_cash,
    'plans', v_plans,
    'paid_payments', v_paid,
    'paid_cash', v_paid_cash,
    'waived', v_waived,
    'archived', p_archive
  );
end;
$$;
