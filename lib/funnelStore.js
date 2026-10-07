export async function writeFunnelEvent(supabase, row) {
  let payload={...row};
  for(let attempt=0;attempt<30;attempt++) {
    const result=await supabase.from('funnel_events').upsert(payload,{onConflict:'event_id',ignoreDuplicates:true});
    if(!result.error) return result;
    const match=String(result.error.message).match(/'([^']+)' column|column '([^']+)'|Could not find the '([^']+)'/i);
    const field=match?.[1]||match?.[2]||match?.[3];
    if(!field || field==='event_id' || !(field in payload)) return result;
    delete payload[field];
  }
  return {error:{message:'funnel_schema_incompatible'}};
}
