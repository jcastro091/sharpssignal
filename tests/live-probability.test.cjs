const test=require('node:test'),assert=require('node:assert/strict');
const {modelProbability,scoringDistribution,clockMinutes}=require('../lib/liveProbability.cjs');
const now=Date.parse('2026-11-13T00:00:00Z');
const play={sport:'basketball_ncaab',market:'totals',side:'Over',point:145.5,home:'Home Team',away:'Away Team',start:(now-3600000)/1000};
const game={date:new Date(play.start*1000).toISOString(),status:{type:{state:'in'},period:2,displayClock:'11:48'},competitors:[{homeAway:'home',score:'45',team:{displayName:play.home}},{homeAway:'away',score:'41',team:{displayName:play.away}}]};
const estimate=(p={},g=game)=>modelProbability({...play,...p},g,now,now);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function scores(h,a){return {...game,competitors:game.competitors.map(c=>({...c,score:String(c.homeAway==='home'?h:a)}))};}
test('compound distribution has unit mass and requested expectation',()=>{
 for(const mean of [0,.1,3,50,120]){const p=scoringDistribution(mean,[[1,.18],[2,.6],[3,.22]]);close(p.reduce((a,b)=>a+b,0),1);close(p.reduce((a,b,i)=>a+i*b,0),mean);}
 assert.equal(scoringDistribution(NaN,[[1,1]]),null);
});
test('totals use exact saved line; over/under complement and integer pushes are separate',()=>{
 const over=estimate(),under=estimate({side:'Under'});assert.ok(over.win>0&&over.win<1);close(over.win,under.lose);close(over.lose,under.win);assert.equal(over.push,0);assert.ok(over.experimental);assert.equal(over.model,'scoring-rate-v1');
 const whole=estimate({point:145});assert.ok(whole.push>0);close(whole.win+whole.lose+whole.push,1);
 assert.ok(estimate({point:130.5}).win>over.win);
 assert.ok(estimate({},scores(55,51)).win>over.win);
 assert.equal(estimate({point:80.5}).win,1); // already over; scores cannot decrease under model
});
test('spread sign and selected team orientation are correct; moneyline fallback resolves overtime',()=>{
 const home=estimate({market:'spreads',side:play.home,point:-4}),away=estimate({market:'spreads',side:play.away,point:4});close(home.win,away.lose);close(home.push,away.push);assert.ok(home.push>0);
 assert.ok(estimate({market:'spreads',side:play.home,point:8.5}).win>home.win);
 const hm=estimate({market:'h2h',side:play.home}),am=estimate({market:'h2h',side:play.away});close(hm.win,am.lose);close(hm.win+am.win,1);assert.equal(hm.push,0);
});
test('sport clocks, halftime and overtime are explicit; malformed inputs fail closed',()=>{
 const config={periods:2,minutes:20};assert.equal(clockMinutes({period:1,displayClock:'0:00'},config).remaining,20);assert.equal(clockMinutes({period:2,displayClock:'20:00'},config).elapsed,20);
 assert.equal(clockMinutes({period:3,displayClock:'4:00'},config).remaining,4);assert.equal(clockMinutes({period:3,displayClock:'4:00'},config).elapsed,41);
 for(const status of [{period:0,displayClock:'1:00'},{period:2,displayClock:'11:99'},{period:2,displayClock:'25:00'},{period:2}])assert.equal(estimate({}, {...game,status:{type:{state:'in'},...status}}),null);
 for(const patch of [{market:'spreads',point:null},{market:'totals',point:''},{market:'totals',side:'Other'},{market:'h2h',side:'Other'},{sport:'baseball_mlb'},{sport:'americanfootball_nfl'}])assert.equal(estimate(patch),null);
 assert.equal(modelProbability(play,game,now-91000,now),null);assert.equal(modelProbability(play,game,now+6000,now),null);
 assert.equal(estimate({}, {...game,date:'invalid'}),null);assert.equal(estimate({}, {...game,competitors:[{...game.competitors[0],score:null},game.competitors[1]]}),null);
 assert.equal(estimate({}, {...game,status:{...game.status,type:{state:'post'}}}),null);
 assert.equal(estimate({}, {...game,status:{...game.status,type:{state:'in',name:'STATUS_DELAYED'}}}),null);
 assert.equal(estimate({home:'Wrong team'}),null);
});
test('NHL ties resolve with one winner goal; shootouts are not treated as timed regulation',()=>{
 const h={...scores(2,2),status:{type:{state:'in'},period:4,displayClock:'2:30'}};
 const over=estimate({sport:'icehockey_nhl',point:4.5},h);close(over.win,1);
 const under=estimate({sport:'icehockey_nhl',side:'Under',point:5.5},h);close(under.win,1);
 const ml=estimate({sport:'icehockey_nhl',market:'h2h',side:play.home},h);close(ml.win,.5);assert.equal(ml.push,0);
 assert.equal(estimate({sport:'icehockey_nhl'}, {...h,status:{...h.status,type:{state:'in',shortDetail:'Shootout'}}}),null);
});
