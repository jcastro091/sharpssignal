-- Signup attribution fields for lead-to-subscribe funnel analysis.

alter table if exists public.leads add column if not exists utm_content text;
alter table if exists public.leads add column if not exists referral_code text;
alter table if exists public.leads add column if not exists page_path text;
alter table if exists public.leads add column if not exists landing_page text;

create index if not exists idx_leads_signup_attribution
  on public.leads(utm_source, utm_campaign, referral_code);
