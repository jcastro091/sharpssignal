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

test('verified Youngstown alias matches scores and both probability paths without weakening identity',async()=>{
 const p={...play,sport:'basketball_ncaab',home:'Youngstown St Penguins',away:'Marshall Thundering Herd',side:'Youngstown St Penguins'};
 const g={...game,competitors:[{homeAway:'home',score:'67',team:{displayName:'Youngstown State Penguins'}},{homeAway:'away',score:'60',team:{displayName:p.away}}]};
 const e={...event,competitions:[g]},s={...summary,header:{competitions:[g]}};
 assert.equal(matchGame(p,[e]).event.id,'123');
 assert.equal(matchGame({...p,away:'Other Herd'},[e]),null);
 assert.equal(matchGame({...p,start:p.start-86400},[e]),null);
 assert.equal(matchGame(p,[e,e]),null);
 assert.equal(matchGame({...p,home:p.away,away:p.home},[e]),null);
 assert.equal(moneylineProbability(p,s,now).win,.72);
 const [row]=await enrichLiveScores([{id:'alias',play:p,result:'pending'}],{now,fetcher:async url=>({ok:true,json:async()=>url.includes('summary')?{}:{events:[e]}})});
 assert.equal(row.live.home_score,67);assert.equal(row.live.probability.model,'scoring-rate-v1');
});

test('scoreboard requests use supported limit so late-day college games are included',async()=>{
 const p={...play,sport:'americanfootball_ncaaf'};let requested;
 const [row]=await enrichLiveScores([{id:'late-game',play:p}],{now,fetcher:async url=>{requested=url;return {ok:true,json:async()=>({events:url.includes('limit=500')?[{...event,competitions:[{...game,status:{type:{state:'pre'}}}]}]:[]})};}});
 assert.equal(new URL(requested).searchParams.get('limit'),'500');assert.equal(row.live.state,'pre');assert.equal(row.live.home_score,null);
});

test('Army Knights tracked side resolves to the ESPN Army Black Knights away probability', async () => {
 const tip = Date.parse('2026-11-26T17:00:00Z');
 const observed = tip + 40 * 60000;
 const p = {...play, start:tip / 1000, sport:'basketball_ncaab', side:'Army Knights', away:'Army Knights', home:'UTSA Roadrunners'};
 const g = {...game, id:'401912231', date:new Date(tip).toISOString(), competitors:[
  {homeAway:'home', score:'27', team:{displayName:p.home}},
  {homeAway:'away', score:'43', team:{displayName:'Army Black Knights'}},
 ]};
 const e = {id:g.id, competitions:[g]};
 const s = {...summary, header:{competitions:[g]}, plays:[{id:'latest', wallclock:new Date(observed - 30000).toISOString()}]};
 const fetcher = async url => ({ok:true, json:async () => url.includes('summary') ? s : {events:[e]}});
 const [row] = await enrichLiveScores([{id:'army', play:p, result:'pending'}], {now:observed, fetcher});
 assert.equal(row.live.event_id, g.id);
 assert.equal(row.live.away_score, 43);
 assert.equal(row.live.probability.source, 'ESPN game-win model');
 assert.ok(Math.abs(row.live.probability.win - 0.28) < 1e-10);
 assert.equal(matchGame({...p, home:'Air Force Falcons'}, [e]), null);
});

test('verified neutral-site orientation preserves the tracked team scores and probabilities', async () => {
 const tip = Date.parse('2026-11-27T02:00:00Z');
 const observed = tip + 90 * 60000;
 const p = {sport:'basketball_ncaab', market:'h2h', start:tip/1000, side:'Louisville Cardinals',
  home:'Louisville Cardinals', away:"St. John's Red Storm"};
 const g = {...game, id:'401920530', date:new Date(tip).toISOString(), neutralSite:true, competitors:[
  {homeAway:'home', score:'90', team:{id:'2599', displayName:p.away}},
  {homeAway:'away', score:'93', team:{id:'97', displayName:p.home}},
 ]};
 const liveSummary = {...summary, header:{competitions:[g]},
  plays:[{id:'latest',wallclock:new Date(observed-30000).toISOString()}]};
 const finalGame = {...g,status:{type:{state:'post',completed:true,shortDetail:'Final'}}};
 const finalEvent = {id:g.id, competitions:[finalGame]};
 assert.equal(matchGame(p,[finalEvent]).event.id,g.id);
 assert.equal(matchGame(p,[{...finalEvent,competitions:[{...finalGame,neutralSite:false}]}]),null);
 assert.equal(matchGame(p,[finalEvent,finalEvent]),null);
 assert.ok(Math.abs(moneylineProbability(p,liveSummary,observed).win-0.28)<1e-10);
 const [row] = await enrichLiveScores([{id:'louisville',play:p,result:'win'}],
  {now:observed,fetcher:async()=>({ok:true,json:async()=>({events:[finalEvent]})})});
 assert.equal(row.live.home_score,93);
 assert.equal(row.live.away_score,90);
 assert.equal(row.live.home_team_id,'97');
 assert.equal(row.live.away_team_id,'2599');
 assert.equal(row.result,'win');
 const [fallback] = await enrichLiveScores([{id:'neutral-live',play:p,result:'pending'}],
  {now:observed+61000,fetcher:async url=>({ok:true,json:async()=>url.includes('summary')?{}:{events:[{id:g.id,competitions:[g]}]}})});
 assert.equal(fallback.live.probability.model,'scoring-rate-v1');
 assert.equal(fallback.live.home_score,93);
});
