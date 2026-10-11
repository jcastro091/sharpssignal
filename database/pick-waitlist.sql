-- Applied to the SharpsSignal production project via Supabase migration create_pick_interest_waitlist.
create table public.pick_waitlist (
  email text primary key check (email = lower(btrim(email)) and length(email) <= 254),
  created_at timestamptz not null default now(),
  consent_version text not null,
  page_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text
);
alter table public.pick_waitlist enable row level security;
revoke all on public.pick_waitlist from anon, authenticated;
grant select, insert, update, delete on public.pick_waitlist to service_role;
comment on table public.pick_waitlist is 'Consent for proposed $5 pick availability updates only; no automatic delivery or newsletter enrollment.';
