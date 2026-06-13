-- SharpSignal operational schema.
-- Supabase/Postgres is the source of truth for clean app-facing records.
-- S3 remains the raw archive/model-artifact store; Sheets can remain a mirror.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  full_name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  email text primary key,
  sport_interest text not null default 'all',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ref_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text unique,
  plan text,
  status text not null default 'unknown',
  entitlement_active boolean not null default false,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_runs (
  cycle_id text primary key,
  runner text not null,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz,
  sports_checked jsonb not null default '[]'::jsonb,
  events_seen integer,
  future_events_seen integer,
  alerts_generated integer,
  no_alert_reason text,
  active_key text,
  primary_used integer,
  primary_remaining integer,
  backup_used integer,
  backup_remaining integer,
  model_run_id text,
  model_version text,
  model_path text,
  thresholds_path text,
  track_base_sec integer,
  error text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_usage_snapshots (
  snapshot_id text primary key,
  cycle_id text references public.pipeline_runs(cycle_id) on delete set null,
  observed_at timestamptz not null default now(),
  key_name text not null,
  sport text,
  used integer,
  remaining integer,
  last_request integer,
  cap integer,
  used_pct numeric,
  remaining_pct numeric,
  projected_monthly_used numeric,
  alert_level text,
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.model_runs (
  model_run_id text primary key,
  model_version text,
  model_path text,
  thresholds_path text,
  test_auc numeric,
  test_accuracy numeric,
  last_week_auc numeric,
  last_week_accuracy numeric,
  threshold numeric,
  status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_predictions (
  bet_id text primary key,
  observed_at timestamptz not null default now(),
  sport text,
  away_team text,
  home_team text,
  market text,
  market_key text,
  setup text,
  direction text,
  pick_side text,
  tier_code text,
  tier_label text,
  model_probability numeric,
  edge numeric,
  stake numeric,
  odds_decimal numeric,
  odds_american numeric,
  opening_decimal numeric,
  peak_decimal numeric,
  current_decimal numeric,
  closing_decimal numeric,
  closing_odds_american numeric,
  clv_pct numeric,
  game_time timestamptz,
  actual_winner text,
  prediction_result text,
  official boolean not null default false,
  model_run_id text,
  model_version text,
  model_path text,
  thresholds_path text,
  run_cycle_id text,
  api_key_name text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.picks (
  bet_id text primary key references public.model_predictions(bet_id) on delete cascade,
  observed_at timestamptz not null default now(),
  sport text,
  away_team text,
  home_team text,
  market text,
  market_key text,
  setup text,
  direction text,
  pick_side text,
  tier_code text,
  tier_label text,
  model_probability numeric,
  edge numeric,
  stake numeric,
  odds_decimal numeric,
  odds_american numeric,
  opening_decimal numeric,
  peak_decimal numeric,
  current_decimal numeric,
  closing_decimal numeric,
  closing_odds_american numeric,
  clv_pct numeric,
  game_time timestamptz,
  model_run_id text,
  model_version text,
  run_cycle_id text,
  api_key_name text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bets (
  bet_id text primary key references public.picks(bet_id) on delete cascade,
  observed_at timestamptz not null,
  alert_sent_at timestamptz,
  ledger_locked_at timestamptz,
  sport text,
  away_team text,
  home_team text,
  market text,
  market_key text,
  setup text,
  direction text,
  pick_side text,
  tier_code text,
  tier_label text,
  model_probability numeric,
  edge numeric,
  stake numeric,
  odds_decimal numeric,
  odds_american numeric,
  opening_decimal numeric,
  peak_decimal numeric,
  current_decimal numeric,
  closing_decimal numeric,
  closing_odds_american numeric,
  clv_pct numeric,
  game_time timestamptz,
  model_run_id text,
  model_version text,
  run_cycle_id text,
  api_key_name text,
  status text not null default 'open',
  result text not null default 'pending',
  pnl numeric,
  roi numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bet_results (
  bet_id text primary key references public.bets(bet_id) on delete cascade,
  graded_at timestamptz not null default now(),
  result text not null,
  actual_winner text,
  pnl numeric,
  roi numeric,
  source text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.closing_lines (
  closing_line_id text primary key,
  bet_id text not null references public.picks(bet_id) on delete cascade,
  captured_at timestamptz not null default now(),
  book text,
  closing_odds_american numeric,
  closing_decimal numeric,
  line numeric,
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.alerts (
  alert_id text primary key,
  bet_id text references public.picks(bet_id) on delete set null,
  channel text not null,
  status text not null,
  sent_at timestamptz,
  recipient text,
  message text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.x_posts (
  post_id text primary key,
  bet_id text references public.picks(bet_id) on delete set null,
  tweet_id text unique,
  post_type text not null default 'pick',
  caption text,
  status text not null default 'posted',
  posted_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.grading_events (
  grading_event_id text primary key,
  bet_id text references public.picks(bet_id) on delete set null,
  event_type text not null,
  event_at timestamptz not null default now(),
  status text not null,
  raw jsonb not null default '{}'::jsonb
);

create or replace view public.v_betting_kpis as
select
  count(*) filter (where b.bet_id is not null) as bets,
  count(*) filter (where b.status = 'closed') as closed,
  count(*) filter (where b.result = 'win') as wins,
  count(*) filter (where b.result = 'loss') as losses,
  sum(b.stake) as staked,
  sum(b.pnl) as pnl,
  case when sum(b.stake) > 0 then sum(b.pnl) / sum(b.stake) end as roi,
  avg(b.clv_pct) as avg_clv_pct
from public.bets b;

create or replace view public.v_betting_segments as
select
  sport,
  market,
  tier_code,
  count(*) as bets,
  count(*) filter (where status = 'closed') as closed,
  count(*) filter (where result = 'win') as wins,
  sum(stake) as staked,
  sum(pnl) as pnl,
  case when sum(stake) > 0 then sum(pnl) / sum(stake) end as roi,
  avg(clv_pct) as avg_clv_pct,
  avg(model_probability) as avg_model_probability
from public.bets
group by sport, market, tier_code;

create index if not exists idx_picks_observed_at on public.picks(observed_at desc);
create index if not exists idx_picks_sport_market on public.picks(sport, market);
create index if not exists idx_bets_observed_at on public.bets(observed_at desc);
create index if not exists idx_bets_result on public.bets(result);
create index if not exists idx_pipeline_runs_started_at on public.pipeline_runs(started_at desc);
create index if not exists idx_api_usage_observed_at on public.api_usage_snapshots(observed_at desc);
create index if not exists idx_alerts_sent_at on public.alerts(sent_at desc);
create index if not exists idx_x_posts_posted_at on public.x_posts(posted_at desc);

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.subscriptions enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.api_usage_snapshots enable row level security;
alter table public.model_runs enable row level security;
alter table public.model_predictions enable row level security;
alter table public.picks enable row level security;
alter table public.bets enable row level security;
alter table public.bet_results enable row level security;
alter table public.closing_lines enable row level security;
alter table public.alerts enable row level security;
alter table public.x_posts enable row level security;
alter table public.grading_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
    create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_own') then
    create policy subscriptions_select_own on public.subscriptions for select using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
