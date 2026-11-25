const test=require('node:test'),assert=require('node:assert/strict');
const {performance}=require('../lib/trackedPerformance.cjs');
const {dashboard}=require('../lib/trackedPlays.cjs');
const row=(id,pnl,time,strategies=['C0'])=>({id,record_type:'live',sportsbook:'Polymarket US',pnl_cents:pnl,settlement_recorded_at:time,created_at:'2026-11-24T20:00:00Z',strategies,play:{sport:'basketball_ncaab',market:'h2h'},stake_cents:71,result:pnl==null?'pending':pnl>0?'win':'loss'});
const live={generated_at:1795650000,venues:{polymarket_us:{initial_pilot_cash_usd:'100',initial_pilot_observed_at:1795500000,cash_usd:'100.22'},kalshi:{initial_pilot_cash_usd:'9.96',initial_pilot_observed_at:1795500000,cash_usd:'98.16'}}};
test('settlement chronology includes fee-inclusive losses, not placement time; duplicate orders count once',()=>{
 const loss=row('a',-71,'2026-11-25T01:00:00Z',['C0','C0 + gradient boosting']);
 const win=row('b',230,'2026-11-25T00:00:00Z');
 const d=performance([loss,win,loss,row('c',null,null)],live);
 assert.equal(d.settled,2);assert.deepEqual(d.series[0].events.map(e=>e.pnl),[230,-71]);assert.equal(d.points.at(-1).polymarket_us,159);assert.equal(d.points.at(-1).kalshi,0);assert.equal(d.series[0].pending,1);
});
test('deposit cannot become betting profit or illustrative bankroll; missing baseline is never assumed',()=>{
 const d=performance([],live,'Kalshi','bankroll');assert.equal(d.points.at(-1).kalshi,996);assert.equal(d.series[0].cash,9816);
 const missing=performance([row('a',22,'2026-11-25T01:00:00Z')],{...live,venues:{}},'Polymarket US','bankroll');assert.equal(missing.series[0].baseline,null);assert.equal(missing.points.at(-1).polymarket_us,null);
 assert.equal(performance([row('a',22,null)],live).missingTime,1);
});
test('strategy/date/venue filters intersect and overlapping memberships never multiply an order',()=>{
 const rows=[row('a',-71,'2026-11-25T01:00:00Z',['C0','C0 + gradient boosting']),row('b',93,'2026-11-25T02:00:00Z',['Independent ML + logistic regression'])];
 for(const strategy of ['C0','C0 + gradient boosting']){const d=dashboard(rows,{strategy,book:'Polymarket US',sport:'basketball_ncaab',market:'h2h',from:'2026-11-24',to:'2026-11-24'});assert.equal(d.summary.total,1);assert.equal(d.summary.pnl_cents,-71);assert.equal(performance(d.rows,live).settled,1);}
 assert.equal(dashboard(rows).summary.pnl_cents,22);assert.equal(dashboard(rows,{from:'2026-11-25'}).rows.length,0);assert.equal(dashboard(rows,{book:'Kalshi'}).rows.length,0);
});
