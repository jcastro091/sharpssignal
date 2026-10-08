-- LOCAL REVIEW ONLY. Do not deploy code without separately reviewing/applying this migration.
-- Atomic event deduplication, monotonic updates, and immutable account bindings.
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  payload_hash text not null,
  stripe_subscription_id text not null,
  event_created bigint not null,
  applied_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;
alter table public.subscriptions add column if not exists last_stripe_event_created bigint;

create or replace function public.apply_verified_stripe_event(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  old_event public.stripe_webhook_events%rowtype;
  old_sub public.subscriptions%rowtype;
  sub_id text := payload->>'stripe_subscription_id';
  account_id uuid := (payload->>'user_id')::uuid;
  event_time bigint := (payload->>'event_created')::bigint;
begin
  if sub_id is null or account_id is null or event_time is null
     or nullif(payload->>'event_id', '') is null or nullif(payload->>'payload_hash', '') is null
     or nullif(payload->>'stripe_customer_id', '') is null
     or payload->>'plan' is distinct from 'pro_telegram'
     or nullif(payload->>'status', '') is null
     or payload->>'entitlement_active' is null
     or ((payload->>'entitlement_active')::boolean and payload->>'status' <> 'active') then
    raise exception 'invalid_entitlement_payload';
  end if;
  -- Serialize both event identity and subscription writes across concurrent deliveries.
  perform pg_advisory_xact_lock(hashtextextended('stripe-event:' || (payload->>'event_id'), 0));
  select * into old_event from public.stripe_webhook_events where event_id = payload->>'event_id';
  if found then
    if old_event.payload_hash <> payload->>'payload_hash' or old_event.stripe_subscription_id <> sub_id then
      raise exception 'replay_conflict';
    end if;
    return jsonb_build_object('outcome', 'duplicate');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-sub:' || sub_id, 0));
  select * into old_sub from public.subscriptions where stripe_subscription_id = sub_id for update;
  if found then
    if old_sub.user_id is distinct from account_id
       or old_sub.stripe_customer_id is distinct from payload->>'stripe_customer_id'
       or old_sub.plan is distinct from payload->>'plan'
       or (old_sub.stripe_checkout_session_id is not null and payload->>'stripe_checkout_session_id' is not null
           and old_sub.stripe_checkout_session_id <> payload->>'stripe_checkout_session_id') then
      raise exception 'account_or_checkout_mapping_conflict';
    end if;
    if old_sub.last_stripe_event_created > event_time then
      insert into public.stripe_webhook_events values (payload->>'event_id', payload->>'payload_hash', sub_id, event_time, now());
      return jsonb_build_object('outcome', 'stale');
    end if;
    if old_sub.last_stripe_event_created = event_time and
       (old_sub.status is distinct from payload->>'status'
        or old_sub.entitlement_active is distinct from (payload->>'entitlement_active')::boolean
        or old_sub.cancel_at_period_end is distinct from (payload->>'cancel_at_period_end')::boolean
        or old_sub.current_period_end is distinct from (payload->>'current_period_end')::timestamptz) then
      raise exception 'same_timestamp_conflict';
    end if;
  end if;
  insert into public.subscriptions (user_id, email, stripe_customer_id, stripe_subscription_id,
    stripe_checkout_session_id, plan, status, entitlement_active, current_period_end, cancel_at_period_end, last_stripe_event_created)
  values (account_id, payload->>'email', payload->>'stripe_customer_id', sub_id,
    payload->>'stripe_checkout_session_id', payload->>'plan', payload->>'status', (payload->>'entitlement_active')::boolean,
    (payload->>'current_period_end')::timestamptz, (payload->>'cancel_at_period_end')::boolean, event_time)
  on conflict (stripe_subscription_id) do update set
    status = excluded.status, entitlement_active = excluded.entitlement_active,
    current_period_end = excluded.current_period_end, cancel_at_period_end = excluded.cancel_at_period_end,
    stripe_checkout_session_id = coalesce(public.subscriptions.stripe_checkout_session_id, excluded.stripe_checkout_session_id),
    last_stripe_event_created = excluded.last_stripe_event_created, updated_at = now();
  insert into public.stripe_webhook_events values (payload->>'event_id', payload->>'payload_hash', sub_id, event_time, now());
  return jsonb_build_object('outcome', 'applied');
end;
$$;
revoke all on function public.apply_verified_stripe_event(jsonb) from public, anon, authenticated;
grant execute on function public.apply_verified_stripe_event(jsonb) to service_role;
