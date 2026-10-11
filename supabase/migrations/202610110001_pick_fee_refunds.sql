-- Pick fees are separate from subscriptions, wagering stakes and research P&L.
create table public.pick_fee_purchases (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 pick_id text not null check(length(pick_id) between 1 and 200),
 payment_intent_id text not null unique,
 checkout_session_id text unique,
 amount_paid_cents integer not null check(amount_paid_cents > 0),
 currency text not null check(currency ~ '^[a-z]{3}$'),
 billing_mode text not null check(billing_mode in ('live','test')),
 product_type text not null default 'pick' check(product_type='pick'),
 guarantee_version text not null check(guarantee_version='pick_fee_loss_v1'),
 qa_test boolean not null default false,
 status text not null default 'paid' check(status in ('paid','partially_refunded','refunded')),
 snapshot jsonb not null default '{}',
 created_at timestamptz not null default now(),
 check((billing_mode='test')=qa_test)
);
create index pick_fee_purchases_owner on public.pick_fee_purchases(user_id,created_at desc);
create index pick_fee_purchases_created on public.pick_fee_purchases(created_at desc,id);
create table public.pick_fee_settlements (
 pick_id text not null,
 billing_mode text not null check(billing_mode in ('live','test')),
 result text not null check(result in ('win','loss','push','void')),
 status text not null default 'final' check(status='final'),
 verified boolean not null default true check(verified),
 evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),
 source_url text not null,
 evidence jsonb not null,
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 primary key(pick_id,billing_mode)
);
create table public.pick_fee_refund_claims (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null unique references public.pick_fee_purchases(id),
 admin_id uuid not null references auth.users(id),
 amount_cents integer not null check(amount_cents>0),
 evidence_hash text not null,
 status text not null default 'claimed' check(status in ('claimed','pending','succeeded','failed','canceled')),
 stripe_refund_id text unique,
 created_at timestamptz not null default now(),
 checked_at timestamptz,
 failure_code text
);
create table public.pick_fee_refund_events (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null references public.pick_fee_purchases(id),
 claim_id uuid references public.pick_fee_refund_claims(id),
 actor_id uuid not null references auth.users(id),
 event_type text not null,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index pick_fee_refund_events_purchase on public.pick_fee_refund_events(purchase_id,created_at);
alter table public.pick_fee_purchases enable row level security;
alter table public.pick_fee_settlements enable row level security;
alter table public.pick_fee_refund_claims enable row level security;
alter table public.pick_fee_refund_events enable row level security;
revoke all on public.pick_fee_purchases,public.pick_fee_settlements,public.pick_fee_refund_claims,public.pick_fee_refund_events from anon,authenticated;
grant select,insert on public.pick_fee_purchases,public.pick_fee_settlements to service_role;
grant select on public.pick_fee_refund_claims,public.pick_fee_refund_events to service_role;

create function public.reserve_pick_fee_refund(p_purchase_id uuid,p_admin_id uuid,p_amount integer,p_evidence_hash text)
returns public.pick_fee_refund_claims language plpgsql security definer set search_path='' as $$
declare p public.pick_fee_purchases; s public.pick_fee_settlements; c public.pick_fee_refund_claims;
begin
 select * into p from public.pick_fee_purchases where id=p_purchase_id for update;
 if not found then raise exception 'purchase_not_found'; end if;
 select * into s from public.pick_fee_settlements where pick_id=p.pick_id and billing_mode=p.billing_mode for share;
 if not found or s.result<>'loss' or not s.verified or s.evidence_hash<>p_evidence_hash then raise exception 'verified_losing_pick_required'; end if;
 select * into c from public.pick_fee_refund_claims where purchase_id=p.id;
 if found then return c; end if;
 if p_amount<1 or p_amount>p.amount_paid_cents then raise exception 'invalid_refund_amount'; end if;
 insert into public.pick_fee_refund_claims(purchase_id,admin_id,amount_cents,evidence_hash)
 values(p.id,p_admin_id,p_amount,p_evidence_hash) returning * into c;
 insert into public.pick_fee_refund_events(purchase_id,claim_id,actor_id,event_type,details)
 values(p.id,c.id,p_admin_id,'refund_reserved',jsonb_build_object('amount_cents',p_amount,'evidence_hash',p_evidence_hash));
 return c;
end $$;

create function public.complete_pick_fee_refund(p_claim_id uuid,p_refund_id text,p_status text,p_amount integer,p_total_refunded integer,p_currency text,p_failure_code text default null)
returns public.pick_fee_refund_claims language plpgsql security definer set search_path='' as $$
declare c public.pick_fee_refund_claims; p public.pick_fee_purchases;
begin
 -- Same locking order as reservation: purchase, then claim.
 select * into c from public.pick_fee_refund_claims where id=p_claim_id;
 if not found then raise exception 'refund_claim_missing'; end if;
 select * into p from public.pick_fee_purchases where id=c.purchase_id for update;
 select * into c from public.pick_fee_refund_claims where id=p_claim_id for update;
 if p_amount<>c.amount_cents or p_currency<>p.currency or p_total_refunded<0 or p_total_refunded>p.amount_paid_cents
 or p_status not in ('pending','succeeded','failed','canceled') or p_refund_id not like 're_%'
 or (c.stripe_refund_id is not null and c.stripe_refund_id<>p_refund_id)
 then raise exception 'refund_response_mismatch'; end if;
 if c.status='succeeded' and p_status<>'succeeded' then raise exception 'refund_status_regression'; end if;
 if c.stripe_refund_id is null or c.status<>p_status then
  insert into public.pick_fee_refund_events(purchase_id,claim_id,actor_id,event_type,details)
  values(p.id,c.id,c.admin_id,'refund_'||p_status,jsonb_build_object('stripe_refund_id',p_refund_id,'amount_cents',p_amount,'failure_code',p_failure_code));
 end if;
 update public.pick_fee_refund_claims set stripe_refund_id=p_refund_id,status=p_status,checked_at=now(),failure_code=p_failure_code where id=c.id returning * into c;
 update public.pick_fee_purchases set status=case when p_status='succeeded' and p_total_refunded=amount_paid_cents then 'refunded'
  when p_total_refunded>0 and p_status='succeeded' then 'partially_refunded' else status end where id=p.id;
 return c;
end $$;
revoke all on function public.reserve_pick_fee_refund(uuid,uuid,integer,text),public.complete_pick_fee_refund(uuid,text,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.reserve_pick_fee_refund(uuid,uuid,integer,text),public.complete_pick_fee_refund(uuid,text,text,integer,integer,text,text) to service_role;
notify pgrst,'reload schema';
