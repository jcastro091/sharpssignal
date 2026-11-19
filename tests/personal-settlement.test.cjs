const test=require('node:test'),assert=require('node:assert/strict');
const {personalSettlement,savedPersonalSettlement}=require('../lib/personalSettlement.cjs');
const {gradeTrackedPlay,publicationKey}=require('../lib/trackedPlays.cjs');
const now=Date.parse('2026-11-19T15:00:00Z');
function fixture(){const snapshot={entry_id:'original-receipt',cohort:'Original forward',play_key:'original-game-spread',sport:'basketball_ncaab',event:'source-event',home:'Florida Gators',away:'Houston Cougars',side:'Florida Gators',market:'spreads',point:-1.5,start:Date.parse('2026-11-18T21:30:00Z')/1000};return {row:{id:'own-slip',play_key:publicationKey(snapshot),snapshot,sportsbook:'FanDuel',odds_american:-105,stake_cents:1000,created_at:'2026-11-18T20:27:29.553Z'},score:{source:'ESPN',sport:'basketball_ncaab',state:'post',completed:true,final_status:'STATUS_FINAL',event_id:'401920514',home_team_id:'57',away_team_id:'248',home:'Florida Gators',away:'Houston Cougars',home_score:76,away_score:86,official_start:'2026-11-18T21:48:00Z',checked_at:new Date(now).toISOString()}};}
test('own Florida -1.5 is a ten-dollar loss despite a research exclusion; original snapshot and terms stay unchanged',()=>{
 const {row,score}=fixture(),before=JSON.stringify(row),settlement=personalSettlement(row,score,{now});
 assert.equal(settlement.result,'loss');assert.equal(settlement.pnl_cents,-1000);
 const latest={...row.snapshot,quarantined:'verified_pregame_schedule_conflict',result:null};
 assert.equal(gradeTrackedPlay(row,latest).result,'pending');
 assert.equal(gradeTrackedPlay({...row,settlement},latest).result,'loss');
 assert.equal(gradeTrackedPlay({...row,settlement},null).pnl_cents,-1000);
 assert.equal(JSON.stringify(row),before);
 // The persisted receipt remains valid after live-score fetching has expired.
 assert.equal(savedPersonalSettlement({...row,settlement}).result,'loss');
});
test('unsupported, incomplete, stale, wrong-team or wrong-schedule score data cannot close a personal slip',()=>{
 for(const change of [{completed:false},{final_status:'STATUS_CANCELED'},{state:'in'},{source:'other'},{sport:'basketball_nba'},{event_id:''},{home_team_id:''},{home:'Other Gators'},{home_score:null},{away_score:86.5},{official_start:'2026-11-19T21:48:00Z'},{checked_at:new Date(now-180000).toISOString()}]){
  const {row,score}=fixture();assert.equal(personalSettlement(row,{...score,...change},{now}),null,JSON.stringify(change));
 }
 const {row,score}=fixture();assert.equal(personalSettlement({...row,created_at:'2026-11-18T22:00:00Z'},score,{now}),null);
 const altered={...row,snapshot:{...row.snapshot,market:'first_half_spreads'}};assert.equal(personalSettlement(altered,score,{now}),null);
});
test('saved receipt cannot be reused for altered odds, stake, line, source identity or another slip',()=>{
 const {row,score}=fixture(),settlement=personalSettlement(row,score,{now});
 for(const change of [{id:'other-slip'},{stake_cents:2000},{odds_american:150},{snapshot:{...row.snapshot,point:1.5}},{snapshot:{...row.snapshot,entry_id:'other-source'}}])assert.equal(savedPersonalSettlement({...row,...change,settlement}),null);
 assert.equal(savedPersonalSettlement({...row,settlement:{...settlement,result:'win'}}),null);
 assert.equal(savedPersonalSettlement({...row,settlement:{...settlement,pnl_cents:2000}}),null);
});
test('full-game spread, total and moneyline settlement respects original side/line and own odds',()=>{
 const {row,score}=fixture();
 function grade(p){const snapshot={...row.snapshot,...p};return personalSettlement({...row,snapshot,play_key:publicationKey(snapshot)},score,{now});}
 assert.equal(grade({side:'Houston Cougars',point:-10}).result,'push');
 assert.equal(grade({side:'Houston Cougars',point:-9.5}).pnl_cents,952);
 assert.equal(grade({market:'totals',side:'Over',point:162}).result,'push');
 assert.equal(grade({market:'totals',side:'Under',point:162.5}).result,'win');
 assert.equal(grade({market:'h2h',side:'Houston Cougars',point:null}).result,'win');
});
