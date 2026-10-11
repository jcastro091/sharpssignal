create table public.pick_fee_offers (
 id uuid primary key default gen_random_uuid(),
 home_team text not null, away_team text not null, sport text not null,
 market text not null, game_time timestamptz not null,
 price_cents integer not null default 500 check(price_cents=500), currency text not null default 'usd' check(currency='usd'),
 billing_mode text not null check(billing_mode in ('live','test')),
 owner_verification boolean not null default false,
 selection jsonb not null, source jsonb not null,
 active boolean not null default true,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index pick_fee_offers_upcoming on public.pick_fee_offers(billing_mode,game_time) where active;
create table public.pick_fee_orders (
 id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.pick_fee_offers(id),
 user_id uuid not null references auth.users(id),
 checkout_session_id text unique,
 status text not null default 'created' check(status in ('created','paid')),
 created_at timestamptz not null default now(),
 unique(offer_id,user_id)
);
create index pick_fee_orders_owner on public.pick_fee_orders(user_id,created_at desc);
alter table public.pick_fee_purchases add column owner_verification boolean not null default false;
alter table public.pick_fee_purchases add column tax_cents integer not null default 0 check(tax_cents>=0 and tax_cents<=amount_paid_cents);
alter table public.pick_fee_offers enable row level security;
alter table public.pick_fee_orders enable row level security;
revoke all on public.pick_fee_offers,public.pick_fee_orders from anon,authenticated;
grant select,insert on public.pick_fee_offers,public.pick_fee_orders to service_role;
grant update(checkout_session_id) on public.pick_fee_orders to service_role;
alter table public.pick_fee_purchases add column processing_fee_cents integer check(processing_fee_cents>=0);
create function public.record_paid_pick_order(p_order uuid,p_checkout text,p_payment text,p_user uuid,p_offer uuid,p_amount integer,p_currency text,p_live boolean,p_tax integer,p_fee integer default null)
returns public.pick_fee_purchases language plpgsql security definer set search_path='' as $$
declare o public.pick_fee_orders; f public.pick_fee_offers; p public.pick_fee_purchases;
begin
 select * into o from public.pick_fee_orders where id=p_order for update;
 if not found then raise exception 'order_not_found'; end if;
 select * into f from public.pick_fee_offers where id=o.offer_id;
 if o.user_id<>p_user or o.offer_id<>p_offer or p_amount is distinct from f.price_cents or p_currency is distinct from f.currency
 or p_live is distinct from (f.billing_mode='live') or p_tax is null or p_tax<0 or p_tax>p_amount
 or p_payment is null or p_payment not like 'pi_%' or p_checkout is null or p_checkout not like 'cs_%'
 or (o.checkout_session_id is not null and o.checkout_session_id<>p_checkout) then raise exception 'payment_binding_mismatch'; end if;
 select * into p from public.pick_fee_purchases where id=o.id;
 if found then
  if p.payment_intent_id<>p_payment or p.checkout_session_id<>p_checkout then raise exception 'order_already_paid'; end if;
  if p.processing_fee_cents is null and p_fee is not null then update public.pick_fee_purchases set processing_fee_cents=p_fee where id=p.id returning * into p; end if;
  return p;
 end if;
 insert into public.pick_fee_purchases(id,user_id,pick_id,payment_intent_id,checkout_session_id,amount_paid_cents,currency,billing_mode,qa_test,guarantee_version,owner_verification,tax_cents,processing_fee_cents,snapshot)
 values(o.id,o.user_id,f.id::text,p_payment,p_checkout,p_amount,p_currency,f.billing_mode,f.billing_mode='test','pick_fee_loss_v1',f.owner_verification,p_tax,p_fee,
 jsonb_build_object('home_team',f.home_team,'away_team',f.away_team,'sport',f.sport,'market',f.market,'game_time',f.game_time,'selection',f.selection,'source',f.source)) returning * into p;
 update public.pick_fee_orders set checkout_session_id=p_checkout,status='paid' where id=o.id;
 return p;
end $$;
revoke all on function public.record_paid_pick_order(uuid,text,text,uuid,uuid,integer,text,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.record_paid_pick_order(uuid,text,text,uuid,uuid,integer,text,boolean,integer,integer) to service_role;
-- A card network may reverse an initially successful refund. Record the new
-- provider state and restore the order balance instead of hiding a failure.
create or replace function public.complete_pick_fee_refund(p_claim_id uuid,p_refund_id text,p_status text,p_amount integer,p_total_refunded integer,p_currency text,p_failure_code text default null)
returns public.pick_fee_refund_claims language plpgsql security definer set search_path='' as $$
declare c public.pick_fee_refund_claims; p public.pick_fee_purchases;
begin
 select * into c from public.pick_fee_refund_claims where id=p_claim_id;
 if not found then raise exception 'refund_claim_missing'; end if;
 select * into p from public.pick_fee_purchases where id=c.purchase_id for update;
 select * into c from public.pick_fee_refund_claims where id=p_claim_id for update;
 if p_amount is distinct from c.amount_cents or p_currency is distinct from p.currency or p_total_refunded is null or p_total_refunded<0 or p_total_refunded>p.amount_paid_cents
 or p_status is null or p_status not in ('pending','succeeded','failed','canceled') or p_refund_id is null or p_refund_id not like 're_%'
 or (c.stripe_refund_id is not null and c.stripe_refund_id<>p_refund_id)
 or (c.status='succeeded' and p_status not in ('succeeded','failed','canceled'))
 then raise exception 'refund_response_mismatch'; end if;
 if c.stripe_refund_id is null or c.status<>p_status then
 insert into public.pick_fee_refund_events(purchase_id,claim_id,actor_id,event_type,details)
 values(p.id,c.id,c.admin_id,'refund_'||p_status,jsonb_build_object('stripe_refund_id',p_refund_id,'amount_cents',p_amount,'failure_code',p_failure_code));
 end if;
 update public.pick_fee_refund_claims set stripe_refund_id=p_refund_id,status=p_status,checked_at=now(),failure_code=p_failure_code where id=c.id returning * into c;
 update public.pick_fee_purchases set status=case when p_total_refunded=amount_paid_cents and p_status='succeeded' then 'refunded' when p_total_refunded>0 then 'partially_refunded' else 'paid' end where id=p.id;
 return c;
end $$;
notify pgrst,'reload schema';
create function public.admin_pick_refund_rows(p_mode text,p_limit integer default 100)
returns table(id uuid,user_id uuid,customer_email text,customer_name text,pick_id text,amount_paid_cents integer,currency text,status text,created_at timestamptz,snapshot jsonb,owner_verification boolean,tax_cents integer,processing_fee_cents integer,settlement_result text,settlement_verified boolean,refund_status text,stripe_refund_id text,failure_code text)
language sql security definer set search_path='' as $$
 select p.id,p.user_id,u.email::text,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),p.pick_id,p.amount_paid_cents,p.currency,p.status,p.created_at,p.snapshot,p.owner_verification,p.tax_cents,p.processing_fee_cents,s.result,s.verified,c.status,c.stripe_refund_id,c.failure_code
 from public.pick_fee_purchases p join auth.users u on u.id=p.user_id
 left join public.pick_fee_settlements s on s.pick_id=p.pick_id and s.billing_mode=p.billing_mode
 left join public.pick_fee_refund_claims c on c.purchase_id=p.id
 where p.billing_mode=p_mode order by p.created_at desc limit greatest(1,least(p_limit,100));
$$;
revoke all on function public.admin_pick_refund_rows(text,integer) from public,anon,authenticated;
grant execute on function public.admin_pick_refund_rows(text,integer) to service_role;
create table public.pick_fee_automation_state (
 billing_mode text primary key check(billing_mode in ('live','test')),
 checked_at timestamptz not null, summary jsonb not null
);
alter table public.pick_fee_automation_state enable row level security;
revoke all on public.pick_fee_automation_state from anon,authenticated;
grant select,insert,update on public.pick_fee_automation_state to service_role;
notify pgrst,'reload schema';
alter table public.pick_fee_purchases add column refund_checked_at timestamptz;
grant update(refund_checked_at) on public.pick_fee_purchases to service_role;
create unique index pick_fee_owner_verification_offer on public.pick_fee_offers(created_by,billing_mode) where owner_verification;
