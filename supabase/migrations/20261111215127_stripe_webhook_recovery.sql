-- Durable receipts for pre-account-bound subscriptions; these never grant access.
create table if not exists public.stripe_webhook_review (
  event_id text primary key,
  payload_hash text not null,
  stripe_subscription_id text not null,
  stripe_customer_id text not null,
  event_created bigint not null,
  event_type text not null,
  reason text not null check (reason='legacy_subscription_missing_account_binding'),
  recorded_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.stripe_webhook_review enable row level security;
revoke all on public.stripe_webhook_review from public,anon,authenticated;
grant select,insert on public.stripe_webhook_review to service_role;
comment on table public.stripe_webhook_review is 'Verified Stripe legacy deliveries requiring explicit account reconciliation. No email-based mapping or entitlement grants.';
