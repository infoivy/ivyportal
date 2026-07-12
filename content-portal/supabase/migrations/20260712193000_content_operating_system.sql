create extension if not exists pgcrypto;

create type public.content_stage as enum ('idea','research','script','ready','recorded','editing','scheduled','published','repurpose');
create type public.content_funnel_stage as enum ('tof','mof','bof');
create type public.system_status as enum ('draft','active','paused','archived');

-- Explicit private allowlist. Add only the founder's auth user here.
create table public.founder_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create or replace function public.is_content_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.founder_access where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_content_founder() from public;
grant execute on function public.is_content_founder() to authenticated;

create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  title text not null check (char_length(title) between 1 and 180),
  hook text not null default '',
  core_idea text,
  promise text,
  pillar text not null default 'Founder POV',
  funnel_stage public.content_funnel_stage not null,
  format text not null default 'Talking head',
  primary_platform text not null default 'Instagram',
  platforms text[] not null default array['Instagram']::text[],
  status public.content_stage not null default 'idea',
  priority smallint not null default 2 check (priority between 1 and 3),
  scheduled_for date,
  recording_date date,
  published_at timestamptz,
  post_url text,
  raw_asset_url text,
  edited_asset_url text,
  thumbnail_url text,
  script text,
  caption text,
  cta text,
  inspiration_url text,
  hypothesis text,
  target_avatar text,
  pain_point text,
  belief_shift text,
  tags text[] not null default '{}',
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  views bigint not null default 0 check (views >= 0),
  reach bigint not null default 0 check (reach >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  shares bigint not null default 0 check (shares >= 0),
  saves bigint not null default 0 check (saves >= 0),
  profile_visits bigint not null default 0 check (profile_visits >= 0),
  follows bigint not null default 0 check (follows >= 0),
  leads bigint not null default 0 check (leads >= 0),
  booked_calls bigint not null default 0 check (booked_calls >= 0),
  sales bigint not null default 0 check (sales >= 0),
  attributed_revenue numeric(14,2) not null default 0 check (attributed_revenue >= 0),
  avg_watch_seconds numeric(10,2),
  retention_percent numeric(6,2) check (retention_percent is null or retention_percent between 0 and 100),
  notes text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_pieces_status_idx on public.content_pieces(status, scheduled_for);
create index content_pieces_published_idx on public.content_pieces(published_at desc) where published_at is not null;
create index content_pieces_tags_idx on public.content_pieces using gin(tags);

create table public.content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces(id) on delete cascade,
  captured_by uuid not null default auth.uid() references auth.users(id),
  window_label text not null check (window_label in ('24h','72h','7d','30d','lifetime','manual')),
  views bigint not null default 0,
  reach bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  leads bigint not null default 0,
  booked_calls bigint not null default 0,
  sales bigint not null default 0,
  attributed_revenue numeric(14,2) not null default 0,
  retention_percent numeric(6,2),
  raw_payload jsonb not null default '{}',
  captured_at timestamptz not null default now(),
  unique(content_piece_id, window_label, captured_at)
);

create table public.content_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  metric text not null,
  target numeric(14,2) not null,
  current_value numeric(14,2) not null default 0,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  check(period_end >= period_start)
);

create table public.content_systems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  purpose text,
  cadence text,
  status public.system_status not null default 'draft',
  steps jsonb not null default '[]',
  success_definition text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  name text not null,
  hypothesis text not null,
  variable text not null,
  control_description text,
  variant_description text,
  status public.system_status not null default 'draft',
  started_at date,
  ended_at date,
  result text,
  winning_variant text,
  created_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  title text not null default 'New operator session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id),
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

-- Append-only audit trail: operational history is never silently rewritten.
create table public.content_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  happened_at timestamptz not null default now()
);

create or replace function public.set_content_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_pieces_updated_at before update on public.content_pieces for each row execute function public.set_content_updated_at();
create trigger content_systems_updated_at before update on public.content_systems for each row execute function public.set_content_updated_at();
create trigger ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_content_updated_at();

create or replace function public.audit_content_piece()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_events(actor_id, entity_type, entity_id, event_type, before_state, after_state)
  values (
    auth.uid(), 'content_piece', coalesce(new.id, old.id), lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_content_piece_trigger after insert or update or delete on public.content_pieces for each row execute function public.audit_content_piece();

alter table public.founder_access enable row level security;
alter table public.content_pieces enable row level security;
alter table public.content_metric_snapshots enable row level security;
alter table public.content_goals enable row level security;
alter table public.content_systems enable row level security;
alter table public.content_experiments enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.content_events enable row level security;

create policy "founder can read own access" on public.founder_access for select to authenticated using (user_id = (select auth.uid()));
create policy "founder owns content" on public.content_pieces for all to authenticated using ((select public.is_content_founder())) with check ((select public.is_content_founder()) and created_by = (select auth.uid()));
create policy "founder owns metric history" on public.content_metric_snapshots for all to authenticated using ((select public.is_content_founder())) with check ((select public.is_content_founder()) and captured_by = (select auth.uid()));
create policy "founder owns goals" on public.content_goals for all to authenticated using ((select public.is_content_founder())) with check ((select public.is_content_founder()) and owner_id = (select auth.uid()));
create policy "founder owns systems" on public.content_systems for all to authenticated using ((select public.is_content_founder())) with check ((select public.is_content_founder()) and owner_id = (select auth.uid()));
create policy "founder owns experiments" on public.content_experiments for all to authenticated using ((select public.is_content_founder())) with check ((select public.is_content_founder()) and owner_id = (select auth.uid()));
create policy "founder owns conversations" on public.ai_conversations for all to authenticated using ((select public.is_content_founder()) and owner_id = (select auth.uid())) with check ((select public.is_content_founder()) and owner_id = (select auth.uid()));
create policy "founder owns messages" on public.ai_messages for all to authenticated using ((select public.is_content_founder()) and owner_id = (select auth.uid())) with check ((select public.is_content_founder()) and owner_id = (select auth.uid()));
create policy "founder reads audit history" on public.content_events for select to authenticated using ((select public.is_content_founder()));

-- No client update/delete policy exists for content_events. The trigger is its only writer.
revoke insert, update, delete on public.content_events from authenticated;

-- After creating the founder in Authentication, run once in the SQL editor:
-- insert into public.founder_access(user_id)
-- select id from auth.users where email = 'YOUR_FOUNDER_EMAIL';
