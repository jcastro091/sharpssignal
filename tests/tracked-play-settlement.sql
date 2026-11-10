-- Integration regression; run after migrations. Leaves no fixture rows behind.
begin;
insert into public.customer_research_versions(section,play_key,payload_hash,payload,seen_at) values
('sports','qa-immediate-grade','qa-one','{"result":"win","settlement_status":"verified_final_score"}',now()-interval '1 minute'),
('sports','qa-pending-grade','qa-two','{"result":null}',now()-interval '1 minute'),
('sports','qa-corrected-grade','qa-three','{"result":"win","settlement_status":"verified_final_score"}',now()-interval '2 hours'),
('sports','qa-corrected-grade','qa-four','{"result":null,"settlement_status":"no_unique_exact_match"}',now()-interval '1 minute');
do $$ begin
  if (select count(*) from public.tracked_play_results(array['qa-immediate-grade','qa-pending-grade','qa-corrected-grade'],now()-interval '30 minutes'))<>1 then
    raise exception 'settlement_gate_regression';
  end if;
  if not exists(select 1 from public.tracked_play_results(array['qa-immediate-grade'],now()-interval '30 minutes') where payload->>'result'='win') then
    raise exception 'verified_final_not_immediate';
  end if;
end $$;
rollback;
