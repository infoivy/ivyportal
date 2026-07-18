-- One persistent team channel: alert messages, optionally tagged to a student.
create table public.student_alerts (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(body) between 1 and 4000),
  student_id uuid references public.students(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index student_alerts_created_at_idx on public.student_alerts (created_at desc);
alter table public.student_alerts enable row level security;

-- Whole team reads and posts; history is permanent (no update policy);
-- admins can delete a message if it truly must go.
create policy "alerts team read" on public.student_alerts
  for select using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder') or has_role(auth.uid(), 'coach')
    or has_role(auth.uid(), 'csm') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
  );
create policy "alerts team insert" on public.student_alerts
  for insert with check (
    created_by = auth.uid() and (
      has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder') or has_role(auth.uid(), 'coach')
      or has_role(auth.uid(), 'csm') or has_role(auth.uid(), 'closer') or has_role(auth.uid(), 'setter')
    )
  );
create policy "alerts admin delete" on public.student_alerts
  for delete using (has_role(auth.uid(), 'admin'));
