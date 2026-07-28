-- Read-gap fixes (portal-wide data-consistency audit, 2026-07-28).
-- Silent-empty SELECT holes: RLS denials return zero rows (not errors), so
-- these surfaces rendered zeros/"Unknown" instead of failing loudly:
--   1. deals: no founder/cofounder SELECT, yet Finance (founder+cofounder
--      surface) computes payouts from deals -> payouts understated, profit
--      overstated. Revenue/Payouts/dashboard-cash/leaderboards read empty.
--   2. profiles: the team-read list predates the cofounder enum value, so a
--      pure cofounder saw 8-char id fragments instead of names.
--   3. user_roles: closer/coach/csm/setter saw only their own rows, so every
--      client-side roster join collapsed (Revenue closer/setter lists,
--      Sales HQ active setters, coach-name resolution, deal attribution
--      dropdowns). Widened to the role MAP only; no money tables involved.
--   4. csm_tally: coach passes the /csm page guard but read zeros.
--   5. closer gaps on fulfillment reads shown inside the student detail page
--      (weekly EODs, placements, CSM notes, call attendance).
--   6. student_alerts: cofounder unlocks fulfillment alerts in the bell
--      (founder-confirmed 2026-07-12) but had no SELECT.
-- Additive SELECT-only policies; nothing existing is weakened. Setters gain
-- NO deals/installments/payment access; students hold no team role and gain
-- nothing from any of these.

create policy "Founder/cofounder view deals"
  on public.deals for select to authenticated
  using (
    public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
  );

create policy "Cofounders view profiles"
  on public.profiles for select to authenticated
  using (public.has_role(auth.uid(), 'cofounder'));

create policy "Team roles view user roles"
  on public.user_roles for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder')
    or public.has_role(auth.uid(), 'closer')
    or public.has_role(auth.uid(), 'coach')
    or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'setter')
  );

create policy "Coaches view csm tally"
  on public.csm_tally for select to authenticated
  using (public.has_role(auth.uid(), 'coach'));

create policy "Closers view weekly student EODs"
  on public.student_weekly_eods for select to authenticated
  using (public.has_role(auth.uid(), 'closer'));

create policy "Closers view placements"
  on public.student_placements for select to authenticated
  using (public.has_role(auth.uid(), 'closer'));

create policy "Closers view csm student notes"
  on public.csm_student_notes for select to authenticated
  using (public.has_role(auth.uid(), 'closer'));

create policy "Closers view call attendance"
  on public.student_call_attendance for select to authenticated
  using (public.has_role(auth.uid(), 'closer'));

create policy "Cofounders view student alerts"
  on public.student_alerts for select to authenticated
  using (public.has_role(auth.uid(), 'cofounder'));
