
CREATE TYPE public.installment_payment_status AS ENUM ('upcoming','paid','late','missed','waived');

CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view installments" ON public.installments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Staff can insert installments" ON public.installments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Staff can update installments" ON public.installments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Admins can delete installments" ON public.installments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER installments_set_updated_at
BEFORE UPDATE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date date NOT NULL,
  status public.installment_payment_status NOT NULL DEFAULT 'upcoming',
  paid_at date,
  payment_method text,
  notes text,
  reminded_3d_at timestamptz,
  reminded_1d_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX installment_payments_due_idx ON public.installment_payments(due_date, status);
CREATE INDEX installment_payments_installment_idx ON public.installment_payments(installment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_payments TO authenticated;
GRANT ALL ON public.installment_payments TO service_role;

ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payments" ON public.installment_payments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Staff can insert payments" ON public.installment_payments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Staff can update payments" ON public.installment_payments FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'setter')
  OR public.has_role(auth.uid(),'coach') OR public.has_role(auth.uid(),'csm')
);
CREATE POLICY "Admins can delete payments" ON public.installment_payments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER installment_payments_set_updated_at
BEFORE UPDATE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
