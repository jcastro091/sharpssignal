const test=require('node:test'),assert=require('node:assert/strict');
const {sample,append,schema}=require('../lib/probabilityTimeline.cjs');
const now=Date.parse('2026-11-26T16:45:00Z');
const row={id:'live_'+'a'.repeat(64),live:{state:'in',status:'2nd',event_id:'1',checked_at:new Date(now).toISOString(),probability:{win:.3,lose:.7,tie:0,source:'ESPN game-win model',as_of:new Date(now-1000).toISOString()}}};
test('actual timestamped probability and source persist once per minute without invented history',()=>{
 const point=sample(row,now,'release');assert.equal(point.win,.3);assert.equal(point.model,'ESPN game-win model');assert.equal(point.experimental,false);
 const first=append({schema,points:[]},point);assert.equal(first.points.length,1);assert.equal(append(first,sample(row,now+1000,'release')),first);
 assert.equal(append(first,sample({...row,live:{...row.live,probability:{...row.live.probability,win:.4,lose:.6}}},now+60000,'release')).points.length,2);
});
test('stale/future/invalid/pregame/final values are gaps, never guessed zero or100 percent',()=>{
 for(const live of [{...row.live,state:'pre'},{...row.live,state:'post'},{...row.live,probability:{...row.live.probability,win:2}}, {...row.live,checked_at:new Date(now-91000).toISOString()},{...row.live,probability:{...row.live.probability,as_of:new Date(now-181000).toISOString()}}])assert.equal(sample({...row,live},now,'release').win,null);
 const own=sample({...row,live:{...row.live,probability:{...row.live.probability,experimental:true,model:'scoring-rate-v1',source:'SharpsSignal experimental model'}}},now,'release');assert.equal(own.experimental,true);assert.equal(own.model,'scoring-rate-v1');
});
