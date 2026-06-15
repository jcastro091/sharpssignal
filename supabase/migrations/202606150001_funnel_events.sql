-- First-party revenue funnel instrumentation.
-- Run this in Supabase before relying on /api/events persistence.

create extension if not exists pgcrypto;

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  visitor_id text,
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  source text not null default 'web',
  page_path text,
  page_url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnel_events_created_at on public.funnel_events(created_at desc);
create index if not exists idx_funnel_events_event_name on public.funnel_events(event_name);
create index if not exists idx_funnel_events_visitor on public.funnel_events(visitor_id, created_at desc);
create index if not exists idx_funnel_events_session on public.funnel_events(session_id, created_at desc);
create index if not exists idx_funnel_events_email on public.funnel_events(email, created_at desc);
create index if not exists idx_funnel_events_utm on public.funnel_events(utm_source, utm_medium, utm_campaign);

alter table public.funnel_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'funnel_events'
      and policyname = 'funnel_events_service_all'
  ) then
    create policy funnel_events_service_all
      on public.funnel_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
