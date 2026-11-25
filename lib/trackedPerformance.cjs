const venues=[['polymarket_us','Polymarket US'],['kalshi','Kalshi']];
const value=v=>v==null||v===''?null:Number.isFinite(Number(v))?Math.round(Number(v)*100):null;
function performance(rows,live,book='',mode='profit'){
 const seen=new Set(),unique=rows.filter(r=>r.record_type==='live'&&!seen.has(r.id)&&seen.add(r.id));
 const selected=venues.filter(([,name])=>!book||book===name).map(([key,name])=>{
  const account=live?.venues?.[key]||{},own=unique.filter(r=>r.sportsbook===name);
  const events=own.filter(r=>r.pnl_cents!=null&&Number.isFinite(r.pnl_cents)&&Number.isFinite(Date.parse(r.settlement_recorded_at))).map(r=>({at:Date.parse(r.settlement_recorded_at),pnl:r.pnl_cents,id:r.id})).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  return {key,name,events,baseline:value(account.initial_pilot_cash_usd),baselineAt:Number(account.initial_pilot_observed_at)*1000,cash:value(account.cash_usd),cashAt:Number(account.cash_observed_at)*1000,pending:own.filter(r=>r.pnl_cents==null).length,missingTime:own.filter(r=>r.pnl_cents!=null&&!Number.isFinite(Date.parse(r.settlement_recorded_at))).length};
 });
 const times=selected.flatMap(s=>s.events.map(e=>e.at));
 const starts=selected.map(s=>s.baselineAt).filter(t=>Number.isFinite(t)&&t>0);
 const start=Math.min(...starts,...times),end=Number(live?.generated_at)*1000;
 const timeline=[...new Set([start,...times,Math.max(start+1000,Number.isFinite(end)?end:start+1000)])].filter(Number.isFinite).sort((a,b)=>a-b);
 const points=timeline.map(at=>{const point={at};for(const s of selected){const pnl=s.events.filter(e=>e.at<=at).reduce((sum,e)=>sum+e.pnl,0);point[s.key]=mode==='bankroll'?(s.baseline==null||at<s.baselineAt?null:s.baseline+pnl):pnl;}return point;});
 return {series:selected,points,settled:times.length,missingTime:selected.reduce((n,s)=>n+s.missingTime,0),manual:rows.filter(r=>r.record_type!=='live').length};
}
module.exports={performance};
