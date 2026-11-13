const test=require('node:test'),assert=require('node:assert/strict');
const {modelProbability,supportedModelSports}=require('../lib/liveProbability.cjs'),{paths,enrichLiveScores}=require('../lib/liveScores.cjs');
const {baseballState,baseballOutcomes,footballOutcomes}=require('../lib/liveStateModels.cjs');
const now=Date.parse('2026-11-13T01:30:00Z'),date=new Date(now-3600000).toISOString();
const competitors=[{id:'H',homeAway:'home',score:'14',team:{displayName:'Home Team',abbreviation:'HOM'}},{id:'A',homeAway:'away',score:'10',team:{displayName:'Away Team',abbreviation:'AWY'}}];
const base={date,seasonType:2,status:{period:3,displayClock:'8:00',type:{state:'in',detail:'8:00 - 3rd'}},competitors,situation:{possession:'H',possessionText:'AWY 20',down:1,distance:10,homeTimeouts:3,awayTimeouts:3}};
const play={sport:'americanfootball_nfl',market:'h2h',side:'Home Team',home:'Home Team',away:'Away Team',start:Date.parse(date)/1000};
const baseball={...base,status:{period:7,type:{state:'in',detail:'Top 7th'}},competitors:competitors.map((c,i)=>({...c,score:i?'3':'2'})),situation:{outs:1,onFirst:false,onSecond:true,onThird:false}};
const get=(sport,market='h2h',game=base,patch={})=>modelProbability({...play,sport,market,side:market==='totals'?'Over':play.side,...patch},game,now,now);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('every tracked league has an explicit model and all three markets return normalized probabilities',()=>{
 assert.deepEqual([...supportedModelSports].sort(),Object.keys(paths).sort());assert.equal(supportedModelSports.length,7);
 for(const sport of supportedModelSports){const g=sport==='baseball_mlb'?baseball:sport.startsWith('americanfootball_')?base:{...base,status:{period:2,displayClock:'8:00',type:{state:'in'}}};for(const market of ['h2h','spreads','totals']){const p=get(sport,market,g,{point:market==='totals'?(sport==='baseball_mlb'?8.5:50.5):-3.5});assert.ok(p,`${sport} ${market}`);close(p.win+p.lose+p.push,1);assert.ok(p.win>=0&&p.win<=1);}}
});
test('football exact-line complements, pushes and repeatable calculations share the same simulated outcomes',()=>{
 const over=get('americanfootball_nfl','totals',base,{point:44}),under=get('americanfootball_nfl','totals',base,{side:'Under',point:44});close(over.win,under.lose);close(over.push,under.push);assert.ok(over.push>0);
 const home=get('americanfootball_nfl','spreads',base,{point:-3}),away=get('americanfootball_nfl','spreads',base,{side:play.away,point:3});close(home.win,away.lose);close(home.push,away.push);
 assert.ok(get('americanfootball_nfl','totals',base,{point:35.5}).win>get('americanfootball_nfl','totals',base,{point:55.5}).win);
 assert.deepEqual(get('americanfootball_nfl'),get('americanfootball_nfl'));
 assert.equal(get('americanfootball_nfl').model,'football-drive-v1');
});
test('football possession, red-zone position and late kneel-down state affect the forecast',()=>{
 const late={...base,competitors:competitors.map(c=>({...c,score:'20'})),status:{...base.status,period:4,displayClock:'0:20'}};
 const red=get('americanfootball_nfl','h2h',late).win;
 const own=get('americanfootball_nfl','h2h',{...late,situation:{...late.situation,possessionText:'HOM 5'}}).win;assert.ok(red>own);
 const kneel={...late,competitors:competitors.map((c,i)=>({...c,score:i?'17':'20'})),situation:{...late.situation,awayTimeouts:0}};close(get('americanfootball_nfl','h2h',kneel).win,1);
 assert.equal(get('americanfootball_nfl','h2h',{...late,situation:{}}),null);
 assert.equal(get('americanfootball_nfl','h2h',{...late,competitors:late.competitors.map(({id,...c})=>c),situation:{}}),null);
});
test('NFL overtime allows regular-season ties; NCAA overtime resolves without ties',()=>{
 const tied={...base,status:{period:4,displayClock:'0:00',type:{state:'in'}},competitors:competitors.map(c=>({...c,score:'20'}))};
 const nfl=get('americanfootball_nfl','h2h',tied),college=get('americanfootball_ncaaf','h2h',tied);assert.ok(nfl.push>0);assert.equal(college.push,0);
 const ot={...tied,status:{...tied.status,period:5,displayClock:'8:00'},otCompleted:[]};assert.ok(get('americanfootball_nfl','h2h',ot));assert.equal(get('americanfootball_nfl','h2h',{...ot,otCompleted:undefined}),null);
 const collegeOt={...ot,status:{...ot.status,period:7,displayClock:'0:00'},otCompleted:['A']};const c=get('americanfootball_ncaaf','h2h',collegeOt);assert.ok(c);assert.equal(c.push,0);
 const post=get('americanfootball_nfl','h2h',{...tied,seasonType:3});assert.equal(post.push,0);
});
test('baseball validates inning/half/outs/bases and models innings instead of a running clock',()=>{
 assert.equal(baseballState(baseball).half,0);assert.equal(get('baseball_mlb','h2h',baseball).model,'baseball-state-v1');
 const invalid=[{...baseball,status:{period:0,type:{state:'in',detail:'Top 7th'}}},{...baseball,situation:{...baseball.situation,outs:4}},{...baseball,situation:{outs:1}},{...baseball,seasonType:undefined}];for(const g of invalid)assert.equal(get('baseball_mlb','h2h',g),null);
 const mid={...baseball,status:{period:7,type:{state:'in',detail:'Middle 7th'}},situation:{}};assert.deepEqual(baseballState(mid),{inning:7,half:1,outs:0,bases:[false,false,false]});
 const end={...mid,status:{period:9,type:{state:'in',detail:'End 9th'}}};assert.deepEqual(baseballState(end),{inning:10,half:0,outs:0,bases:[false,true,false]});
});
test('baseball accounts for runners, outs, no bottom ninth when ahead and walk-off termination',()=>{
 const empty={...baseball,status:{period:9,type:{state:'in',detail:'Bottom 9th'}},situation:{outs:0,onFirst:false,onSecond:false,onThird:false}};
 const loaded={...empty,situation:{...empty.situation,onFirst:true,onSecond:true,onThird:true}};
 assert.ok(get('baseball_mlb','h2h',loaded).win>get('baseball_mlb','h2h',empty).win);
 assert.ok(get('baseball_mlb','h2h',empty).win>get('baseball_mlb','h2h',{...empty,situation:{...empty.situation,outs:2}}).win);
 const ahead={...empty,competitors:competitors.map((c,i)=>({...c,score:i?'2':'3'}))};const final=baseballOutcomes(ahead,3,2);assert.deepEqual(final,[[3,2,1]]);
 const over=get('baseball_mlb','totals',baseball,{point:8}),under=get('baseball_mlb','totals',baseball,{side:'Under',point:8});close(over.win,under.lose);assert.ok(over.push>0);
 const extra={...empty,status:{period:10,type:{state:'in',detail:'Top 10th'}},situation:{outs:0,onFirst:false,onSecond:true,onThird:false},competitors:competitors.map(c=>({...c,score:'3'}))};assert.equal(get('baseball_mlb','h2h',extra).push,0);
 assert.notDeepEqual(baseballOutcomes(extra,3,3),baseballOutcomes({...extra,seasonType:3,situation:{...extra.situation,onSecond:false}},3,3));
});
test('real enrichment supplies season context, uses local missing-provider fallback and preserves grades',async()=>{
 const rows=['americanfootball_nfl','americanfootball_ncaaf','baseball_mlb'].flatMap(sport=>['h2h','spreads','totals'].map(market=>({id:sport+market,play:{...play,sport,market,side:market==='totals'?'Over':play.home,point:market==='totals'?8.5:-1.5},result:'pending',pnl_cents:null})));
 const fetcher=async url=>({ok:true,json:async()=>{if(url.includes('summary'))return {};const sport=url.includes('baseball')?'baseball_mlb':url.includes('college-football')?'americanfootball_ncaaf':'americanfootball_nfl';const g=sport==='baseball_mlb'?baseball:base;return {events:[{id:'98765',date,season:{type:2},competitions:[{...g,id:'98765'}]}]};}});
 const enriched=await enrichLiveScores(rows,{fetcher,now});for(const r of enriched){assert.ok(r.live.probability,r.id);assert.equal(r.result,'pending');assert.equal(r.pnl_cents,null);}
});
