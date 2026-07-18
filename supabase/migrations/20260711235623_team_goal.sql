-- Collective weekly team goal: "5k by Thursday" — amount, deadline, and an
-- optional rally note ("expenses put us $1.5k in debt — we need money asap").
alter table public.founder_settings
  add column if not exists team_goal_amount numeric,
  add column if not exists team_goal_deadline date,
  add column if not exists team_goal_started date,
  add column if not exists team_goal_note text;
