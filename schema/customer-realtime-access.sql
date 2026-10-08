create table if not exists public.customer_entitlements (
 stripe_session_id text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 billing_mode text not null check (billing_mode in ('live','test')),
 plan text not null check (plan='pro_telegram'),
 status text not null check (status in ('paid','revoked')),
 stripe_payment_intent_id text unique,
 stripe_subscription_id text unique,
 stripe_customer_id text not null,
 paid_at timestamptz not null,
 valid_until timestamptz not null,
 verified_at timestamptz not null,
 revoked_at timestamptz,
 qa_test boolean not null default false,
 amount_cents integer not null check (amount_cents>0),
 currency text not null,
 check (valid_until>paid_at),
 check ((qa_test and stripe_payment_intent_id is not null and amount_cents=100 and currency='usd')
        or (not qa_test and stripe_subscription_id is not null))
);
create index if not exists customer_entitlements_user_idx on public.customer_entitlements(user_id);
alter table public.customer_entitlements enable row level security;
revoke all on public.customer_entitlements from anon, authenticated;
grant select,insert,update,delete on public.customer_entitlements to service_role;

create table if not exists public.customer_telegram_invites (
 invite_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 telegram_user_id text not null,
 chat_id text not null,
 stripe_session_id text not null references public.customer_entitlements(stripe_session_id),
 expires_at timestamptz not null,
 used_at timestamptz,
 qa_test boolean not null default false
);
create index if not exists customer_telegram_invites_expiry_idx on public.customer_telegram_invites(expires_at);
alter table public.customer_telegram_invites enable row level security;
revoke all on public.customer_telegram_invites from anon, authenticated;
grant select,insert,update,delete on public.customer_telegram_invites to service_role;

create table if not exists public.customer_alert_deliveries (
 delivery_key text primary key,
 stripe_session_id text references public.customer_entitlements(stripe_session_id),
 user_id uuid references auth.users(id) on delete cascade,
 status text not null check(status in ('sending','sent','failed','uncertain')),
 qa_test boolean not null default false,
 provider_message_id bigint,
 destination_hash text not null,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
alter table public.customer_alert_deliveries enable row level security;
revoke all on public.customer_alert_deliveries from anon, authenticated;
grant select,insert,update,delete on public.customer_alert_deliveries to service_role;

create or replace function public.apply_customer_payment(payment jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare applied public.customer_entitlements;
begin
 if payment->>'billing_mode' is distinct from 'live' or payment->>'plan' is distinct from 'pro_telegram'
   or payment->>'status' is distinct from 'paid' or payment->>'qa_test' is null
   or (payment->>'amount_cents')::int is null or (payment->>'amount_cents')::int<=0
   or ((payment->>'qa_test')::boolean and ((payment->>'amount_cents')::int<>100 or payment->>'currency' is distinct from 'usd'
   or (payment->>'valid_until')::timestamptz is distinct from (payment->>'paid_at')::timestamptz+interval '30 minutes'))
   or ((payment->>'qa_test')::boolean is false and payment->>'stripe_subscription_id' is null) then raise exception 'invalid_payment_grant'; end if;
 insert into public.customer_entitlements (
  stripe_session_id,user_id,billing_mode,plan,status,stripe_payment_intent_id,stripe_customer_id,
  paid_at,valid_until,verified_at,qa_test,amount_cents,currency,stripe_subscription_id)
 values (payment->>'stripe_session_id',(payment->>'user_id')::uuid,'live','pro_telegram','paid',
  payment->>'stripe_payment_intent_id',payment->>'stripe_customer_id',(payment->>'paid_at')::timestamptz,
  (payment->>'valid_until')::timestamptz,(payment->>'verified_at')::timestamptz,(payment->>'qa_test')::boolean,(payment->>'amount_cents')::int,payment->>'currency',payment->>'stripe_subscription_id')
 on conflict (stripe_session_id) do update set verified_at=excluded.verified_at,
 paid_at=excluded.paid_at,valid_until=excluded.valid_until,amount_cents=excluded.amount_cents,currency=excluded.currency
 where customer_entitlements.user_id=excluded.user_id
  and customer_entitlements.stripe_payment_intent_id is not distinct from excluded.stripe_payment_intent_id
  and customer_entitlements.stripe_subscription_id is not distinct from excluded.stripe_subscription_id
  and customer_entitlements.stripe_customer_id=excluded.stripe_customer_id
  and customer_entitlements.qa_test=excluded.qa_test
  and (not customer_entitlements.qa_test or (customer_entitlements.paid_at=excluded.paid_at and customer_entitlements.valid_until=excluded.valid_until))
  and customer_entitlements.status='paid' and customer_entitlements.revoked_at is null
 returning * into applied;
 if applied.stripe_session_id is null then raise exception 'payment_mapping_conflict'; end if;
 return to_jsonb(applied);
end $$;
revoke all on function public.apply_customer_payment(jsonb) from public,anon,authenticated;
grant execute on function public.apply_customer_payment(jsonb) to service_role;

create table if not exists public.customer_telegram_memberships (
 user_id uuid not null references auth.users(id) on delete cascade,
 telegram_user_id text not null,chat_id text not null,
 stripe_session_id text not null references public.customer_entitlements(stripe_session_id),
 status text not null check(status in ('pending','active','revoked')),
 updated_at timestamptz not null default now(),primary key(chat_id,telegram_user_id)
);
alter table public.customer_telegram_memberships enable row level security;
revoke all on public.customer_telegram_memberships from public,anon,authenticated;
grant select,insert,update,delete on public.customer_telegram_memberships to service_role;

create or replace function public.consume_customer_telegram_code(link_code text,tg_user text,tg_chat text,tg_username text default null)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare linked public.telegram_link_codes;
begin
 if tg_user !~ '^[0-9]+$' or tg_chat is distinct from tg_user then return false; end if;
 select * into linked from public.telegram_link_codes where code=link_code and used_at is null and expires_at>now() for update;
 if linked.user_id is null then return false; end if;
 perform pg_advisory_xact_lock(hashtext('customer-link-'||linked.user_id::text));
 if exists(select 1 from public.telegram_accounts where telegram_user_id=tg_user and user_id is distinct from linked.user_id)
 or exists(select 1 from public.telegram_accounts where user_id=linked.user_id and telegram_user_id<>tg_user)
 then return false; end if;
 insert into public.telegram_accounts(telegram_user_id,user_id,email,telegram_username,telegram_chat_id,linked_at,source)
 values(tg_user,linked.user_id,linked.email,tg_username,tg_chat,now(),'customer_account_link')
 on conflict(telegram_user_id) do update set telegram_username=excluded.telegram_username,telegram_chat_id=excluded.telegram_chat_id,last_seen_at=now(),updated_at=now();
 update public.telegram_link_codes set used_at=now(),used_by_telegram_user_id=tg_user,updated_at=now() where code=link_code;
 return true;
end $$;
revoke all on function public.consume_customer_telegram_code(text,text,text,text) from public,anon,authenticated;
grant execute on function public.consume_customer_telegram_code(text,text,text,text) to service_role;
