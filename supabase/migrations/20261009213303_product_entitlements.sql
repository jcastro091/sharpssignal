alter table public.customer_entitlements add column if not exists products text[] not null default array['sports']::text[];
alter table public.customer_entitlements add constraint customer_entitlements_products_valid check (products <@ array['sports','markets']::text[] and cardinality(products) between 1 and 2 and array_position(products,null) is null and (cardinality(products)=1 or products[1]<>products[2]));
CREATE OR REPLACE FUNCTION public.apply_customer_payment(payment jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare applied public.customer_entitlements;
 selected text[];
begin
 if payment ? 'products' and jsonb_typeof(payment->'products') <> 'array' then raise exception 'invalid_products'; end if;
 select array_agg(p order by p) into selected from jsonb_array_elements_text(coalesce(payment->'products','["sports"]'::jsonb)) p;
 if selected is null or cardinality(selected) not between 1 and 2 or not selected <@ array['sports','markets']::text[] or cardinality(selected) <> (select count(distinct x) from unnest(selected) x) then raise exception 'invalid_products'; end if;
 if payment->>'billing_mode' is distinct from 'live' or payment->>'plan' is distinct from 'pro_telegram'
   or payment->>'status' is distinct from 'paid' or payment->>'qa_test' is null
   or (payment->>'amount_cents')::int is null or (payment->>'amount_cents')::int<=0
   or ((payment->>'qa_test')::boolean and ((payment->>'amount_cents')::int<>100 or payment->>'currency' is distinct from 'usd'
   or (payment->>'valid_until')::timestamptz is distinct from (payment->>'paid_at')::timestamptz+interval '30 minutes'))
   or ((payment->>'qa_test')::boolean is false and payment->>'stripe_subscription_id' is null) then raise exception 'invalid_payment_grant'; end if;
 insert into public.customer_entitlements (
  stripe_session_id,user_id,billing_mode,plan,status,stripe_payment_intent_id,stripe_customer_id,
  paid_at,valid_until,verified_at,qa_test,amount_cents,currency,stripe_subscription_id,products)
 values (payment->>'stripe_session_id',(payment->>'user_id')::uuid,'live','pro_telegram','paid',
  payment->>'stripe_payment_intent_id',payment->>'stripe_customer_id',(payment->>'paid_at')::timestamptz,
  (payment->>'valid_until')::timestamptz,(payment->>'verified_at')::timestamptz,(payment->>'qa_test')::boolean,(payment->>'amount_cents')::int,payment->>'currency',payment->>'stripe_subscription_id',selected)
 on conflict (stripe_session_id) do update set verified_at=excluded.verified_at,
 paid_at=excluded.paid_at,valid_until=excluded.valid_until,amount_cents=excluded.amount_cents,currency=excluded.currency
 where customer_entitlements.user_id=excluded.user_id
  and customer_entitlements.stripe_payment_intent_id is not distinct from excluded.stripe_payment_intent_id
  and customer_entitlements.stripe_subscription_id is not distinct from excluded.stripe_subscription_id
  and customer_entitlements.stripe_customer_id=excluded.stripe_customer_id
  and customer_entitlements.qa_test=excluded.qa_test
  and customer_entitlements.products=excluded.products
  and (not customer_entitlements.qa_test or (customer_entitlements.paid_at=excluded.paid_at and customer_entitlements.valid_until=excluded.valid_until))
  and customer_entitlements.status='paid' and customer_entitlements.revoked_at is null
 returning * into applied;
 if applied.stripe_session_id is null then raise exception 'payment_mapping_conflict'; end if;
 return to_jsonb(applied);
end $function$
;
revoke all on function public.apply_customer_payment(jsonb) from public,anon,authenticated;
grant execute on function public.apply_customer_payment(jsonb) to service_role;
