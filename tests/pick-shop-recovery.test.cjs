const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {fetchPickShop}=require('../lib/pickShopRequest.cjs');
const data={offers:[],recent_plays:[],orders:[],live_sales_enabled:false};
test('stalled headers and body time out, abort, and a fresh retry succeeds',async()=>{
 const original=global.fetch;
 try{
  for(const body of [false,true]){
   let signal;
   global.fetch=async(_,options)=>{signal=options.signal;return body?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{});};
   await assert.rejects(fetchPickShop('live',{timeoutMs:10}),/temporarily unavailable/);
   assert.equal(signal.aborted,true);
  }
  global.fetch=async()=>({ok:true,json:async()=>data});
  assert.deepEqual(await fetchPickShop('live'),data);
 }finally{global.fetch=original;}
});
test('failed, malformed, or cancelled requests never become a successful empty shop',async()=>{
 const original=global.fetch;
 try{
  for(const response of [{ok:false,json:async()=>data},{ok:true,json:async()=>({})}]){
   global.fetch=async()=>response;await assert.rejects(fetchPickShop('live'),/temporarily unavailable/);
  }
  global.fetch=()=>new Promise(()=>{});
  const controller=new AbortController(),promise=fetchPickShop('live',{signal:controller.signal});controller.abort();
  await assert.rejects(promise,/cancelled/);
 }finally{global.fetch=original;}
});
function api({fail=false,missing=false,admin=false}={}){
 const signals=[];
 const query=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>resolve({data:[],error:fail?{message:'private backend detail'}:null}):(...args)=>{if(key==='abortSignal')signals.push(args[0]);return query;}});
 const stubs={
  '../../lib/authServer':{getServerUser:async()=>null},'../../lib/ceoAccess':{getCeoAccess:async()=>({allowed:admin})},
  '../../lib/supabaseServer':{createSupabaseServiceClient:()=>{if(missing)throw Error('secret config');return {from:()=>query};}},
  '../../lib/pickCommerceServer':{dbResult:async p=>{const r=await p;if(r.error)throw Error('commerce_storage_unavailable');return r.data;},commerceStripe:()=>({})},
  '../../lib/pickCommerce.cjs':{teaser:x=>x},'../../lib/recentPlayTeasers.cjs':{latestMatchups:x=>x,recentPlayTeaser:x=>x},
 };
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('pages/api/pick-shop.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>stubs[n],process:{env:{}},AbortSignal,Date});
 const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(d){this.body=d;return this}};
 return {handler:exports.default,res,signals};
}
test('GET storage and configuration failures return retryable sanitized 503',async()=>{
 for(const options of [{fail:true},{missing:true}]){
  const {handler,res}=api(options);await handler({method:'GET',query:{}},res);
  assert.equal(res.code,503);assert.equal(res.headers['Retry-After'],'30');assert.equal(res.body.error,'pick_shop_unavailable');
 }
});
test('GET shares one read deadline and retains closed sales and sandbox authorization',async()=>{
 const {handler,res,signals}=api();await handler({method:'GET',query:{}},res);
 assert.equal(res.code,200);assert.equal(res.body.live_sales_enabled,false);assert.equal(signals.length,2);assert.equal(signals[0],signals[1]);
 const sandbox=api();await sandbox.handler({method:'GET',query:{mode:'test'}},sandbox.res);assert.equal(sandbox.res.code,403);
 const post=api();await post.handler({method:'POST',body:{action:'checkout'}},post.res);assert.equal(post.res.code,401);
});
