-- The Performance workspace is admin/founder/cofounder-only (founder-directed
-- 2026-07-28) and its Team week cards read the base eods table (cash and
-- check-in footers). Founder and cofounder already unlock every money
-- surface; this aligns team EOD read access with that gate. Additive
-- SELECT-only.
create policy "Founders view all eods"
  on public.eods for select to authenticated
  using (
    public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );
