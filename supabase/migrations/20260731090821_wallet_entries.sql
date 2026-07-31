-- WAP card wallets (founder 2026-07-31): the three founders each hold a
-- payment-processor card loaded monthly with commissions + profit share.
-- Every load and spend is one row here; balance = credits minus spends,
-- and unspent money carries forward automatically.
CREATE TABLE public.wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL CHECK (kind IN ('credit', 'spend')),
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000),
  note text NOT NULL CHECK (length(trim(note)) >= 3),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_entries_user_date_idx ON public.wallet_entries (user_id, entry_date DESC);
ALTER TABLE public.wallet_entries ENABLE ROW LEVEL SECURITY;
-- Card holders are exactly the founder + co-founders; the audit log is the
-- control inside that trust circle.
CREATE POLICY "Founders manage card wallets" ON public.wallet_entries
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'founder')
    OR public.has_role(auth.uid(), 'cofounder')
  );
CREATE TRIGGER audit_wallet_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_entries
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
