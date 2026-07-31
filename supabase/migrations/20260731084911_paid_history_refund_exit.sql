-- Paid installment history stays immutable with ONE audited exit: a money
-- operator (admin/closer) flipping paid → refunded with a written note.
-- That is the refund flow shipped 2026-07-31; every other transition off
-- "paid" remains blocked for non-service roles.
CREATE OR REPLACE FUNCTION public.protect_paid_installment_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.status = 'paid' and new.paid_at is null then
      raise exception 'Paid installment rows require paid_at';
    end if;
    if new.status <> 'paid' and new.paid_at is not null then
      raise exception 'Only paid installment rows may have paid_at';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
    and old.status = 'paid'
    and coalesce(auth.role(), '') <> 'service_role'
  then
    if tg_op = 'UPDATE'
      and new.status = 'refunded'
      and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'closer'))
      and length(trim(coalesce(new.notes, ''))) >= 3
    then
      return new;
    end if;
    raise exception 'Paid installment history is immutable; use an audited correction flow'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
