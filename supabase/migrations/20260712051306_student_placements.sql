-- The placement pipeline: every business a student is talking to about a
-- setter role, tracked stage by stage. This is the fulfillment spine —
-- "success" means rows reaching 'placed'.
create table public.student_placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  business_name text not null check (length(business_name) between 1 and 200),
  role_title text not null default 'Appointment setter',
  source text not null default 'student' check (source in ('student', 'ivy')),
  stage text not null default 'lead' check (stage in ('lead', 'interviewing', 'trial', 'placed', 'lost')),
  pay_notes text,
  interview_at timestamptz,
  started_at date,
  ended_at date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_placements_student_idx on public.student_placements (student_id);
create index student_placements_stage_idx on public.student_placements (stage);

grant select, insert, update, delete on public.student_placements to authenticated;
grant all on public.student_placements to service_role;
alter table public.student_placements enable row level security;

-- Fulfillment team manages everything; students manage their own rows.
create policy "placements team manage" on public.student_placements
  for all using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder') or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
  ) with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'founder')
    or public.has_role(auth.uid(), 'cofounder') or public.has_role(auth.uid(), 'csm')
    or public.has_role(auth.uid(), 'coach')
  );
create policy "placements student own" on public.student_placements
  for all using (
    exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.students s where s.id = student_id and s.user_id = auth.uid())
  );

create trigger student_placements_updated_at before update on public.student_placements
  for each row execute function public.set_updated_at();

-- A placement reaching 'placed' IS the student landing a role.
create or replace function public.sync_placement_to_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'placed' and (tg_op = 'INSERT' or old.stage is distinct from 'placed') then
    update public.students
      set offer_landed_at = coalesce(offer_landed_at, now()),
          offers_landed_count = coalesce(offers_landed_count, 0) + 1
      where id = new.student_id;
  end if;
  return new;
end $$;

create trigger student_placements_sync after insert or update of stage on public.student_placements
  for each row execute function public.sync_placement_to_student();
