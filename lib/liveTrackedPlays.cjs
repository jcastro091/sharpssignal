// Venue-confirmed records are projected, never written to the personal-slip table.
const num=v=>v==null||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const cents=v=>num(v)==null?null:Math.round(Number(v)*100);
function liveRows(data){
 const seen=new Set();return (data?.orders||[]).filter(o=>num(o.filled_contracts)>0).flatMap(o=>{
  const key=o.record_key;if(!/^[a-f0-9]{64}$/.test(key||'')||seen.has(key))return [];seen.add(key);
  const stake=cents(o.actual_cash_usd),pnl=cents(o.realized_net_pnl_usd),payout=num(o.settlement_payout_usd),qty=num(o.filled_contracts),price=num(o.outcome_price_usd);
  if(stake==null||stake<0)return [];
  const memberships=o.strategy_memberships?.length?o.strategy_memberships:[o];
  const strategies=[...new Set(memberships.map(m=>m.strategy+(m.model_name?' + '+m.model_name.replaceAll('_',' '):'')))];
  const close=o.clv?.status==='measured'?num(o.clv.closing_price_usd):null;
  const clv=price>0&&price<1&&close>0&&close<1?close/price-1:null;
  const settled=pnl!=null&&payout!=null,result=settled?(payout===0?'loss':payout===qty?'win':'settled'):'pending';
  return [{id:'live_'+key,record_type:'live',read_only:true,settlement_recorded_at:o.settlement_recorded_at?new Date(o.settlement_recorded_at*1000).toISOString():null,created_at:new Date((o.attempted_at||o.created_at)*1000).toISOString(),
   play:{sport:o.sport,side:o.side,home:o.home,away:o.away,market:o.market,point:o.point,start:o.start},
   sportsbook:o.venue==='polymarket_us'?'Polymarket US':'Kalshi',strategies,tags:['Live automated',...strategies],notes:'',
   odds:price>0&&price<1?Math.round(price<=.5?(1/price-1)*100:-100/(1/price-1)):null,
   stake_cents:stake,pnl_cents:settled?pnl:null,result,clv_pct:clv,
   selection_reference:/^[a-f0-9]{64}$/.test(o.selection_reference||'')?o.selection_reference.slice(0,12):null,
   execution:{state:o.state,clv_status:o.clv?.status||null,closing_price_usd:close,contracts:qty,fees_usd:o.fees_usd,payout_usd:o.settlement_payout_usd,outcome_price_usd:o.outcome_price_usd}}];
 });
}
function mergeRows(manual,live){return [...manual.map(r=>({...r,record_type:'manual'})),...liveRows(live)].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));}
async function mergeWithLiveScores(manual,live,enrich){
 const rows=mergeRows(manual,live),actual=rows.filter(r=>r.read_only);
 if(!actual.length)return rows;
 let scored;
 try{scored=await enrich(actual);}catch{scored=actual.map(r=>({...r,live:{unavailable:true}}));}
 const byId=new Map(scored.map(r=>[r.id,r.live]));
 // Score/forecast metadata cannot replace venue fees, settlement or attribution.
 return rows.map(r=>r.read_only?{...r,live:byId.has(r.id)?byId.get(r.id):{unavailable:true}}:r);
}
module.exports={liveRows,mergeRows,mergeWithLiveScores};
