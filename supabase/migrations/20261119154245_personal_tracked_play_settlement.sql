-- Production migration version returned by the Supabase migration service.
alter table public.customer_tracked_plays
  add column if not exists settlement jsonb
  check (settlement is null or jsonb_typeof(settlement)='object');
comment on column public.customer_tracked_plays.settlement is
  'Server-verified personal final-score receipt bound to the immutable original selection, stake and odds. Separate from research eligibility. Existing service-role-only access and owner checks apply.';
