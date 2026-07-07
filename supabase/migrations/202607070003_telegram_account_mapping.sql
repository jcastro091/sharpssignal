create table if not exists public.telegram_accounts (
  telegram_user_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  telegram_username text,
  telegram_chat_id text,
  first_seen_at timestamptz not null default now(),
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source text not null default 'telegram_link_code',
  raw_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.tail_bets (
  tail_bet_id text primary key,
  bet_id text,
  pick_id text,
  email text,
  bettor_label text,
  sportsbook text not null,
  odds_american numeric,
  odds_decimal numeric,
  stake numeric not null,
  pick_side text,
  market text,
  sport text,
  away_team text,
  home_team text,
  status text not null default 'open',
  result text,
  payout numeric,
  pnl numeric,
  clv_pct numeric,
  notes text,
  placed_at timestamptz not null,
  source text not null default 'member_dashboard',
  raw_json text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_tail_bets_bet_id on public.tail_bets(bet_id);
create index if not exists idx_tail_bets_email on public.tail_bets(lower(email));
create index if not exists idx_tail_bets_placed_at on public.tail_bets(placed_at desc);
create index if not exists idx_tail_bets_status on public.tail_bets(status);

create index if not exists idx_telegram_accounts_email on public.telegram_accounts(lower(email));
create index if not exists idx_telegram_accounts_user_id on public.telegram_accounts(user_id);
create index if not exists idx_telegram_accounts_updated_at on public.telegram_accounts(updated_at desc);

create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_telegram_user_id text references public.telegram_accounts(telegram_user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_codes_user_id on public.telegram_link_codes(user_id);
create index if not exists idx_telegram_link_codes_expires_at on public.telegram_link_codes(expires_at);

alter table public.tail_bets add column if not exists telegram_user_id text;
alter table public.tail_bets add column if not exists telegram_username text;
alter table public.tail_bets add column if not exists telegram_chat_id text;
alter table public.tail_bets add column if not exists raw_telegram_update_id text;
alter table public.tail_bets add column if not exists account_link_status text not null default 'unknown';

create index if not exists idx_tail_bets_telegram_user_id on public.tail_bets(telegram_user_id);
create index if not exists idx_tail_bets_account_link_status on public.tail_bets(account_link_status);

alter table public.telegram_accounts enable row level security;
alter table public.telegram_link_codes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_accounts' and policyname = 'telegram_accounts_service_all'
  ) then
    create policy telegram_accounts_service_all on public.telegram_accounts
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_link_codes' and policyname = 'telegram_link_codes_service_all'
  ) then
    create policy telegram_link_codes_service_all on public.telegram_link_codes
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
