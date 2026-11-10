-- My Plays already owns the selection snapshot. Verified final results do not
-- need the discovery-feed delay. Always inspect the newest version first so a
-- newer unresolved/corrected version cannot fall back to an obsolete final.
create or replace function public.tracked_play_results(keys text[], released_before timestamptz)
returns table(play_key text,payload jsonb)
language sql stable security invoker set search_path=public as $$
with newest as (
  select distinct on (v.play_key) v.play_key,v.payload,v.seen_at
  from public.customer_research_versions v
  where v.section='sports' and v.play_key=any(keys) and v.seen_at<=now()
  order by v.play_key,v.seen_at desc
)
select n.play_key,n.payload from newest n
where n.seen_at<=least(released_before,now()-interval '30 minutes')
   or (n.payload->>'settlement_status'='verified_final_score'
       and n.payload->>'result' in ('win','loss','push')
       and coalesce(n.payload->>'quarantined','')='');
$$;
revoke all on function public.tracked_play_results(text[],timestamptz) from public,anon,authenticated;
grant execute on function public.tracked_play_results(text[],timestamptz) to service_role;
