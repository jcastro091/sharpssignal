create index if not exists customer_research_versions_tail_lookup on public.customer_research_versions(section,play_key,seen_at desc);
create or replace function public.tracked_play_results(keys text[], released_before timestamptz)
returns table(play_key text,payload jsonb) language sql stable security invoker set search_path=public as $$
select distinct on (v.play_key) v.play_key,v.payload from public.customer_research_versions v
where v.section='sports' and v.play_key=any(keys)
and v.seen_at<=least(released_before,now()-interval '30 minutes')
order by v.play_key,v.seen_at desc;
$$;
revoke all on function public.tracked_play_results(text[],timestamptz) from public,anon,authenticated;
grant execute on function public.tracked_play_results(text[],timestamptz) to service_role;
