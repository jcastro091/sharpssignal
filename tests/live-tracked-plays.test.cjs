const test=require('node:test'),assert=require('node:assert/strict');
const {liveRows,mergeRows}=require('../lib/liveTrackedPlays.cjs');const {dashboard}=require('../lib/trackedPlays.cjs');
const {mergeWithLiveScores}=require('../lib/liveTrackedPlays.cjs');
const order={record_key:'a'.repeat(64),reference:'short',sport:'basketball_ncaab',market:'h2h',point:null,side:'Away',home:'Home',away:'Away',venue:'polymarket_us',strategy:'C0',strategy_memberships:[{strategy:'C0'},{strategy:'C0',model_name:'gradient_boosting'}],created_at:100,filled_contracts:'2',contracts:'2',state:'settled',actual_cash_usd:'.71',fees_usd:'.03',outcome_price_usd:'.34',settlement_payout_usd:'0',realized_net_pnl_usd:'-.71'};
test('one actual order, two strategy memberships; fills and fee-inclusive PnL never use paper metrics',()=>{
 const rows=liveRows({orders:[order,order,{...order,record_key:'b'.repeat(64),filled_contracts:'0'}],paper_profit:999});assert.equal(rows.length,1);assert.equal(rows[0].stake_cents,71);assert.equal(rows[0].pnl_cents,-71);assert.equal(rows[0].strategies.length,2);assert.equal(rows[0].read_only,true);assert.equal(rows[0].result,'loss');
});
test('shared sportsbook/sport/market/source/status/tag filters work without altering manual entries',()=>{
 const manual={id:'manual',play:{sport:'basketball_nba',market:'spreads',point:3.5},sportsbook:'FanDuel',stake_cents:1000,pnl_cents:null,result:'pending',created_at:'2026-11-25',notes:'test',tags:['Mine']};
 const merged=mergeRows([manual],{orders:[order]});assert.equal(merged.length,2);assert.equal(manual.record_type,undefined);
 for(const filters of [{book:'Polymarket US'},{sport:'basketball_ncaab'},{market:'h2h'},{source:'live'},{status:'settled'},{tag:'Live automated'}]){const d=dashboard(merged,filters);assert.equal(d.rows.length,1);assert.equal(d.summary.pnl_cents,-71);}
 assert.equal(dashboard(merged,{source:'manual'}).rows[0].id,'manual');assert.equal(dashboard(merged,{book:'Kalshi'}).rows.length,0);
});
test('pending filled positions have unknown realized PnL and exact line retained',()=>{const row=liveRows({orders:[{...order,point:-2.5,market:'spreads',realized_net_pnl_usd:null,settlement_payout_usd:null,state:'filled'}]})[0];assert.equal(row.result,'pending');assert.equal(row.pnl_cents,null);assert.equal(row.play.point,-2.5);assert.equal(dashboard([row]).summary.open_stake_cents,71);});

test('automated cards receive live scores/probabilities without changing actual financial receipts',async()=>{
 const input={orders:[{...order,start:1795708800}]};
 const rows=await mergeWithLiveScores([],input,async actual=>actual.map(r=>({...r,stake_cents:999,live:{state:'in',probability:{win:.35,source:'ESPN'}}})));
 assert.equal(rows[0].live.probability.win,.35);assert.equal(rows[0].stake_cents,71);assert.equal(rows[0].play.start,1795708800);
 const failed=await mergeWithLiveScores([],input,async()=>{throw Error()});assert.equal(failed[0].live.unavailable,true);assert.equal(failed[0].pnl_cents,-71);
 const final=await mergeWithLiveScores([],input,async actual=>actual.map(r=>({...r,live:null})));assert.equal(final[0].live,null);
});


test('verified close compares the actual paid price with the same-contract closing price',()=>{
 const {liveRows}=require('../lib/liveTrackedPlays.cjs');
 const fill={record_key:'a'.repeat(64),venue:'kalshi',sport:'basketball_ncaab',created_at:100,
   strategy:'C0',market:'h2h',filled_contracts:'2',actual_cash_usd:'.85',outcome_price_usd:'.41'};
 const [measured]=liveRows({orders:[{...fill,clv:{status:'measured',closing_price_usd:'.44'}}]});
 assert.ok(Math.abs(measured.clv_pct-(.44/.41-1))<.000001);
 assert.equal(measured.play.sport,'basketball_ncaab');
 const [pending]=liveRows({orders:[{...fill,clv:{status:'awaiting_close',closing_price_usd:'.44'}}]});
 assert.equal(pending.clv_pct,null);
 assert.equal(pending.execution.clv_status,'awaiting_close');
});
