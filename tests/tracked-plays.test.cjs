const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../lib/trackedPlays.cjs');
const now=Date.parse('2026-10-11T19:00:00Z');
const play={entry_id:'entry',play_key:'event:spread:away',cohort:'research',side:'Away',point:3.5,market:'spreads',start:(now+3600000)/1000,home:'Home',away:'Away',result:null};
const user={id:'owner',email_confirmed_at:'2026-01-01'};
const input={sportsbook:'FanDuel',odds:-110,stake:25};
const row=()=>core.createTrackedPlay(user,play,input,now);
test('immutable source and owner; duplicate identities ignore changed odds; distinct line is distinct play',()=>{
  const a=row();assert.equal(a.user_id,'owner');assert.equal(a.snapshot,play);assert.equal(a.stake_cents,2500);
  assert.equal(core.createTrackedPlay(user,play,{...input,odds:150},now).id,a.id);
  assert.notEqual(core.createTrackedPlay({id:'other'},play,input,now).id,a.id);
  assert.notEqual(core.createTrackedPlay(user,{...play,point:4.5},input,now).id,a.id);
});
test('cannot backfill settled or started picks; reject malformed amounts and odds',()=>{
  assert.throws(()=>core.createTrackedPlay(user,{...play,start:now/1000},input,now),/started/);
  assert.throws(()=>core.createTrackedPlay(user,{...play,result:'win'},input,now),/settled/);
  for(const stake of [0,-5,Infinity,100001,0.001,'bad'])assert.throws(()=>core.createTrackedPlay(user,play,{...input,stake},now));
  for(const odds of [0,99,-99,1.5,Infinity])assert.throws(()=>core.createTrackedPlay(user,play,{...input,odds},now));
});
test('grades exact selection and line using customer odds; pending never becomes zero',()=>{
  assert.equal(core.gradeTrackedPlay(row(),{...play,result:'win'}).pnl_cents,2273);
  assert.equal(core.gradeTrackedPlay(row(),{...play,result:'loss'}).pnl_cents,-2500);
  assert.equal(core.gradeTrackedPlay(row(),{...play,result:'push'}).pnl_cents,0);
  assert.equal(core.gradeTrackedPlay(row(),{...play,point:4.5,result:'win'}).pnl_cents,null);
  assert.equal(core.gradeTrackedPlay(row(),undefined).pnl_cents,null);
});
test('ROI uses graded stake only; void excluded and pending excluded; correct losses and market grouping',()=>{
  const rows=['win','loss','push','void',null].map(result=>core.gradeTrackedPlay(row(),{...play,result}));
  const data=core.dashboard(rows);assert.equal(data.summary.settled_stake_cents,7500);assert.equal(data.summary.pnl_cents,-227);assert.equal(data.summary.open_stake_cents,2500);assert.equal(data.summary.roi,-227/7500);
  assert.equal(core.dashboard(rows,{status:'pending'}).summary.roi,null);
  assert.match(core.answerQuestion(data,'What sportsbooks am I losing with the most?'),/FanDuel.*lowest.*3 graded/);
  assert.match(core.answerQuestion(core.dashboard([]),'What markets are we crushing?'),/no graded plays/);
});
function route({auth=user,feed={status:200,body:{plays:[{...play,start:Date.now()/1000+3600}]}},fail=false}={}){
  const records=[],operations=[];
  const db={rpc:async()=>({data:[],error:null}),from(table){const op={table};operations.push(op);const chain={select(){return chain},eq(k,v){op[k]=v;return chain},order(){return chain},limit(){return chain},lte(k,v){op[k]=v;return chain},upsert(value,options){op.options=options;if(!records.some(x=>x.id===value.id))records.push(value);return Promise.resolve({error:fail?Error('db down'):null})},then(resolve){return Promise.resolve({data:table==='customer_tracked_plays'?records.filter(x=>x.user_id===op.user_id):table==='member_publication_settings'?[{paused:false}]:[],error:fail?Error('db down'):null}).then(resolve)}};return chain;}};
  const source=fs.readFileSync('pages/api/tracked-plays.js','utf8').replace(/^import[^\n]+\n/gm,'').replace('export default async function handler','async function handler');
  const context={require:()=>core,URL,Date,AbortSignal,process:{env:{}},getServerUser:async()=>auth,customerFeedContext:async()=>({user:auth}),customerFeed:async()=>feed,createSupabaseServiceClient:()=>db,module:{exports:{}}};
  vm.runInNewContext(source+'\nmodule.exports=handler;',context);
  async function call(method,body={},headers={origin:'https://app.test',host:'app.test'}){let code,json;await context.module.exports({method,body,query:{},headers},{setHeader(){},status(n){code=n;return this},json(v){json=v;return this}});return {code,json};}
  return {call,records,operations};
}
test('route denies anonymous, unconfirmed, cross-origin and hidden picks',async()=>{
  assert.equal((await route({auth:null}).call('POST')).code,401);
  assert.equal((await route({auth:{id:'x'}}).call('GET')).code,401);
  assert.equal((await route().call('POST',{}, {origin:'https://evil.test',host:'app.test'})).code,403);
  assert.equal((await route().call('POST',{action:'tail',pick:'hidden'})).code,409);
});
test('real route saves only verified user and server snapshot; retries never change stake',async()=>{
  const r=route(),body={action:'tail',pick:core.signalKey(play),...input,user_id:'victim',result:'win',snapshot:{side:'forged'}};
  assert.equal((await r.call('POST',body)).code,200);assert.equal((await r.call('POST',{...body,stake:500})).code,200);
  assert.equal(r.records.length,1);assert.equal(r.records[0].user_id,'owner');assert.equal(r.records[0].stake_cents,2500);assert.equal(r.records[0].snapshot.side,'Away');
  const response=await r.call('GET');assert.equal(response.json.summary.total,1);assert.equal(response.json.rows[0].result,'pending');assert.ok(r.operations.some(x=>x.table==='customer_tracked_plays'&&x.user_id==='owner'));
});
test('database failure is not reported as saved',async()=>{assert.equal((await route({fail:true}).call('POST',{action:'tail',pick:core.signalKey(play),...input})).code,503);});
