begin;

-- Phase 2: apply restrictive grants and RLS only after the compatible app
-- deployment is live. This avoids breaking either side of the release window.

-- Calendar connection rows contain Google OAuth credentials. Authenticated
-- callers only need connection metadata; all token use stays in server
-- functions through the service client.
drop policy if exists "Users manage own calendar connection" on public.calendar_connections;
create policy "Users view own calendar connection"
  on public.calendar_connections for select to authenticated
  using (auth.uid() = user_id);
create policy "Users delete own calendar connection"
  on public.calendar_connections for delete to authenticated
  using (auth.uid() = user_id);

revoke select, insert, update on public.calendar_connections from authenticated;
grant select (
  id,
  user_id,
  provider,
  google_email,
  calendar_id,
  color_hex,
  connected_at,
  updated_at
) on public.calendar_connections to authenticated;
grant delete on public.calendar_connections to authenticated;

-- Payment details and revenue records are restricted to the money operators.
-- Preserve history by removing browser DELETE capability.
drop policy if exists "Founder/cofounder view deals" on public.deals;
drop policy if exists "deals admin all" on public.deals;
drop policy if exists "deals closer/coach insert" on public.deals;
drop policy if exists "deals own update" on public.deals;
drop policy if exists "deals team read" on public.deals;

create policy "Money stakeholders view deals"
  on public.deals for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );
create policy "Money operators insert deals"
  on public.deals for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  );
create policy "Money operators correct own deals"
  on public.deals for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'closer')
      and (created_by = auth.uid() or closer_id = auth.uid())
    )
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or (
      public.has_role(auth.uid(), 'closer')
      and (created_by = auth.uid() or closer_id = auth.uid())
    )
  );
revoke delete on public.deals from authenticated;

-- Installment-plan access boundary and DELETE revocation.
-- Installment plans and their payment rows use the same closer/admin boundary.
drop policy if exists "Admins can delete installments" on public.installments;
drop policy if exists "Founder/cofounder view installments" on public.installments;
drop policy if exists "Staff can insert installments" on public.installments;
drop policy if exists "Staff can update installments" on public.installments;
drop policy if exists "Staff can view installments" on public.installments;

create policy "Money stakeholders view installments"
  on public.installments for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );
create policy "Money operators insert installments"
  on public.installments for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  );
create policy "Money operators update installments"
  on public.installments for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  );
revoke delete on public.installments from authenticated;

-- Installment-payment access boundary and DELETE revocation.
drop policy if exists "Admins can delete payments" on public.installment_payments;
drop policy if exists "Founder/cofounder view installment payments" on public.installment_payments;
drop policy if exists "Staff can insert payments" on public.installment_payments;
drop policy if exists "Staff can update payments" on public.installment_payments;
drop policy if exists "Staff can view payments" on public.installment_payments;

create policy "Money stakeholders view installment payments"
  on public.installment_payments for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );
create policy "Money operators insert installment payments"
  on public.installment_payments for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  );
create policy "Money operators update installment payments"
  on public.installment_payments for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'closer')
  );
revoke delete on public.installment_payments from authenticated;

-- EOD source tables are corrected only through the audited RPC.
-- Submitted EOD rows remain immutable to browser clients. A correction first
-- archives the exact source row with actor and reason, then atomically removes
-- the operational uniqueness blocker so the member can resubmit.
drop policy if exists "Admins unlock eods for resubmission" on public.eods;
drop policy if exists "Staff delete student eods" on public.student_eods;
drop policy if exists "Staff delete weekly student eods" on public.student_weekly_eods;
revoke delete on public.eods from authenticated;
revoke delete on public.student_eods from authenticated;
revoke delete on public.student_weekly_eods from authenticated;

-- Student-success history is corrected through actor-and-reason RPCs.
drop policy if exists "Coaches/admins delete calls" on public.student_calls;
revoke delete on public.student_calls from authenticated;
revoke delete on public.student_placements from authenticated;
drop policy if exists "Admins delete students" on public.students;
revoke delete on public.students from authenticated;

-- Voided student-success rows are audit records, not ordinary product data.
-- Normal roles only read active rows; admins retain explicit audit access.
drop policy if exists "Team view student calls" on public.student_calls;
drop policy if exists "Student view own calls" on public.student_calls;
drop policy if exists "CSM/founder/cofounder view student calls" on public.student_calls;
create policy "Team view active student calls" on public.student_calls
  for select to authenticated
  using (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'closer')
      or public.has_role(auth.uid(), 'setter')
      or public.has_role(auth.uid(), 'coach')
    )
  );
create policy "Leadership and CSM view active student calls" on public.student_calls
  for select to authenticated
  using (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'csm')
    )
  );
create policy "Student view own active calls" on public.student_calls
  for select to authenticated
  using (
    voided_at is null
    and exists (
      select 1
      from public.students s
      where s.id = student_calls.student_id
        and s.user_id = auth.uid()
    )
  );
create policy "Admins audit voided student calls" on public.student_calls
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "placements team manage" on public.student_placements;
drop policy if exists "placements student own" on public.student_placements;
drop policy if exists "Closers view placements" on public.student_placements;

create policy "placements team view active" on public.student_placements
  for select to authenticated
  using (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'csm')
      or public.has_role(auth.uid(), 'coach')
      or public.has_role(auth.uid(), 'closer')
    )
  );
create policy "placements team insert" on public.student_placements
  for insert to authenticated
  with check (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'csm')
      or public.has_role(auth.uid(), 'coach')
    )
  );
create policy "placements team update active" on public.student_placements
  for update to authenticated
  using (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'csm')
      or public.has_role(auth.uid(), 'coach')
    )
  )
  with check (
    voided_at is null
    and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'founder')
      or public.has_role(auth.uid(), 'cofounder')
      or public.has_role(auth.uid(), 'csm')
      or public.has_role(auth.uid(), 'coach')
    )
  );

create policy "placements student view own active" on public.student_placements
  for select to authenticated
  using (
    voided_at is null
    and exists (
      select 1
      from public.students s
      where s.id = student_placements.student_id
        and s.user_id = auth.uid()
    )
  );
create policy "placements student insert own" on public.student_placements
  for insert to authenticated
  with check (
    voided_at is null
    and exists (
      select 1
      from public.students s
      where s.id = student_placements.student_id
        and s.user_id = auth.uid()
    )
  );
create policy "placements student update own active" on public.student_placements
  for update to authenticated
  using (
    voided_at is null
    and exists (
      select 1
      from public.students s
      where s.id = student_placements.student_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    voided_at is null
    and exists (
      select 1
      from public.students s
      where s.id = student_placements.student_id
        and s.user_id = auth.uid()
    )
  );
create policy "Admins audit voided student placements" on public.student_placements
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

commit;
