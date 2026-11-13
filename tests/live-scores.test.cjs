const test=require('node:test'),assert=require('node:assert/strict');
const {matchGame,moneylineProbability,enrichLiveScores}=require('../lib/liveScores.cjs');
const now=Date.parse('2026-11-13T00:00:00Z');
const play={sport:'basketball_nba',market:'h2h',side:'Home Team',home:'Home Team',away:'Away Team',start:(now-3600000)/1000};
const game={id:'123',date:new Date(now-3600000).toISOString(),status:{period:3,displayClock:'2:00',type:{state:'in',shortDetail:'2:00 - 3rd'}},competitors:[{homeAway:'home',score:'70',team:{displayName:'Home Team'}},{homeAway:'away',score:'60',team:{displayName:'Away Team'}}]};
const event={id:'123',competitions:[game]};
const summary={header:{competitions:[game]},winprobability:[{homeWinPercentage:0.72,tiePercentage:0,playId:'latest'}],plays:[{id:'latest',wallclock:new Date(now-30000).toISOString()}]};
test('score identity requires both oriented teams, a unique event and matching start',()=>{
 assert.equal(matchGame(play,[event]).event.id,'123');
 assert.equal(matchGame(play,[event,event]),null);assert.equal(matchGame({...play,home:'Other'},[event]),null);
 assert.equal(matchGame({...play,start:(now-86400000)/1000},[event]),null);
 assert.equal(matchGame({...play,home:play.away,away:play.home},[event]),null);
});
test('fresh exact-game moneyline estimates respect orientation and exclude stale/future/malformed data',()=>{
 assert.equal(moneylineProbability(play,summary,now).win,0.72);
 assert.ok(Math.abs(moneylineProbability({...play,side:'Away Team'},summary,now).win-0.28)<1e-10);
 assert.equal(moneylineProbability({...play,market:'totals'},summary,now),null);
 assert.equal(moneylineProbability({...play,market:'spreads'},summary,now),null);
 assert.equal(moneylineProbability(play,{...summary,plays:[{id:'latest',wallclock:new Date(now-181000).toISOString()}]},now),null);
 assert.equal(moneylineProbability(play,{...summary,plays:[{id:'latest',wallclock:new Date(now+60000).toISOString()}]},now),null);
 assert.equal(moneylineProbability(play,{...summary,winprobability:[{homeWinPercentage:1.5}]},now),null);
 assert.equal(moneylineProbability({...play,side:'Over 100'},summary,now),null);
 assert.equal(moneylineProbability(play,{...summary,header:{competitions:[{...game,date:'invalid'}]}},now),null);
});
test('score enrichment preserves grades and totals use own model and moneylines prefer ESPN',async()=>{
 const calls=[];const fetcher=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('summary')?summary:{events:[event]}}};
 const rows=await enrichLiveScores([{id:'a',play,result:'pending',pnl_cents:null},{id:'b',play:{...play,market:'totals',side:'Over',point:150.5},result:'pending',pnl_cents:null}],{fetcher,now});
 assert.equal(rows[0].live.home_score,70);assert.equal(rows[0].live.probability.win,0.72);assert.equal(rows[1].live.probability.model,'scoring-rate-v1');assert.equal(rows[1].live.probability.market,'totals');assert.equal(rows[0].result,'pending');assert.equal(rows[0].pnl_cents,null);assert.equal(calls.length,2);
});
test('failed score source does not lose the saved bet or manufacture a zero score',async()=>{
 const [row]=await enrichLiveScores([{id:'x',play:{...play,sport:'icehockey_nhl'},notes:'keep',result:'pending'}],{fetcher:async()=>{throw Error('down')},now});
 assert.equal(row.notes,'keep');assert.deepEqual(row.live,{unavailable:true});
});

test('malformed external arrays never produce an estimate or match',()=>{
 assert.equal(matchGame(play,{}),null);assert.equal(matchGame(play,[{competitions:[{competitors:{}}]}]),null);
 assert.equal(moneylineProbability(play,{...summary,plays:{}},now),null);
 assert.equal(moneylineProbability(play,{...summary,winprobability:{}},now),null);
});

test('missing ESPN probability uses own moneyline model',async()=>{const p={...play,sport:'basketball_wnba'};const [row]=await enrichLiveScores([{id:'fallback',play:p,result:'pending'}],{fetcher:async url=>({ok:true,json:async()=>url.includes('summary')?{}:{events:[event]}}),now});assert.equal(row.live.probability.model,'scoring-rate-v1');assert.equal(row.result,'pending');});

test('fresh football provider probabilities resolve play freshness from drive history',()=>{const football={...summary,plays:undefined,drives:{previous:[],current:{plays:summary.plays}}};assert.equal(moneylineProbability(play,football,now).win,.72);assert.equal(moneylineProbability(play,{...football,drives:{previous:[],current:{plays:[{id:"latest",wallclock:new Date(now-181000).toISOString()}]}}},now),null);});
