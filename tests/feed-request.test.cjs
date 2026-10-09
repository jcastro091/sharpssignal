const test=require('node:test'), assert=require('node:assert/strict');
const {fetchMemberFeed}=require('../lib/feedRequest.cjs');
test('a stalled request times out, aborts the connection, and a fresh retry succeeds', async()=>{
 const original=global.fetch;let aborted=false;
 try{
  global.fetch=(_,options)=>{options.signal.addEventListener('abort',()=>{aborted=true});return new Promise(()=>{});};
  await assert.rejects(fetchMemberFeed('sports',{timeoutMs:20}),/took too long/);
  assert.equal(aborted,true);
  global.fetch=async()=>({ok:true,json:async()=>({plays:[],status:'delayed'})});
  assert.deepEqual(await fetchMemberFeed('sports',{timeoutMs:50}),{plays:[],status:'delayed'});
 }finally{global.fetch=original;}
});
test('a stalled JSON body also times out; failures never become empty successful feeds',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
  await assert.rejects(fetchMemberFeed('markets',{timeoutMs:20}),/took too long/);
  global.fetch=async()=>({ok:false,status:401,json:async()=>({error:'confirmed_account_required'})});
  await assert.rejects(fetchMemberFeed('sports'),/sign in again/);
  global.fetch=async()=>({ok:true,json:async()=>({ok:true})});
  await assert.rejects(fetchMemberFeed('sports'),/invalid response/);
 }finally{global.fetch=original;}
});
