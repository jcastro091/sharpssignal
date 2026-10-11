create table if not exists public.customer_tracked_plays (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  play_key text not null,
  snapshot jsonb not null,
  sportsbook text not null check (length(sportsbook) between 1 and 60),
  odds_american integer not null check (abs(odds_american) between 100 and 100000),
  stake_cents integer not null check (stake_cents between 1 and 10000000),
  created_at timestamptz not null default now(),
  unique(user_id,play_key)
);
create index if not exists customer_tracked_plays_owner_date on public.customer_tracked_plays(user_id,created_at desc);
alter table public.customer_tracked_plays enable row level security;
revoke all on public.customer_tracked_plays from public,anon,authenticated;
grant select,insert,update,delete on public.customer_tracked_plays to service_role;
comment on table public.customer_tracked_plays is 'Self-reported dashboard tails. Exact immutable selection snapshots, isolated from sportsbook imports and funded pilot records. Server verifies owner and feed authorization.';
create index if not exists customer_research_versions_tail_lookup on public.customer_research_versions(section,play_key,seen_at desc);
create or replace function public.tracked_play_results(keys text[], released_before timestamptz)
returns table(play_key text,payload jsonb) language sql stable security invoker set search_path=public as $$
select distinct on (v.play_key) v.play_key,v.payload from public.customer_research_versions v
where v.section='sports' and v.play_key=any(keys)
and v.seen_at<=least(released_before,now()-interval '30 minutes')
order by v.play_key,v.seen_at desc;
$$;
revoke all on function public.tracked_play_results(text[],timestamptz) from public,anon,authenticated;
grant execute on function public.tracked_play_results(text[],timestamptz) to service_role;
