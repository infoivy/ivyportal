-- Per-set reminder tracking + lead confirmation.
-- reminder_log: {"48h": "reminded" | "no_response", "24h": ..., "3h": ..., "1h": ...}
alter table public.set_reminders
  add column if not exists reminder_log jsonb not null default '{}',
  add column if not exists confirmed_at timestamptz,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'cancelled', 'completed'));

-- Any sales team member can update tracking (setters tick their reminders,
-- closers confirm/cancel; visibility of who did what stays in the row).
create policy "Team can update set tracking" on public.set_reminders
  for update using (
    has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'founder')
    or has_role(auth.uid(), 'setter') or has_role(auth.uid(), 'closer')
  );
