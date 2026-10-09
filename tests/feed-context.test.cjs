const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function context({auth,grant,env={}}){
 const source=fs.readFileSync('lib/customerFeedServer.js','utf8').replace(/^import[^\n]+\n/gm,'').replace(/export async function /g,'async function ');
 const sandbox={module:{exports:{}},require:n=>n.includes('productAccess')?require('../lib/productAccess.cjs'):({refreshCustomerGrants:()=>grant()}),process:{env},createPagesServerClient:()=>({auth}),createSupabaseServiceClient:()=>({}),Stripe:function(){},AbortSignal,fetch(){throw Error('unexpected network');},withAuthTimeout:async(operation)=>{let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),15);})]);}finally{clearTimeout(timer);}}};
 vm.runInNewContext(source+'\nmodule.exports=customerFeedContext;',sandbox);return sandbox.module.exports;
}
const user={id:'owner',email_confirmed_at:'2026-01-01'};
const auth={getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{access_token:'verified-session'}}})};
test('stalled access verification still returns delayed access, never real-time permission',async()=>{
 const ctx=await context({auth,grant:()=>new Promise(()=>{}),env:{STRIPE_SECRET_KEY:'test-only'}})({},{});
 assert.equal(ctx.realtimeProducts.length,0);assert.equal(ctx.token,'verified-session');
 const verified=await context({auth,grant:async()=>[{plan:'pro_telegram',products:['markets'],qa_test:false}],env:{STRIPE_SECRET_KEY:'test-only'}})({},{});
 assert.deepEqual(Array.from(verified.realtimeProducts),['markets']);
});
test('stalled authentication rejects; missing and unconfirmed sessions cannot access the feed',async()=>{
 await assert.rejects(context({auth:{...auth,getUser:()=>new Promise(()=>{})}})({},{}),/timeout/);
 assert.equal(await context({auth:{...auth,getUser:async()=>({data:{user:{id:'owner'}}})}})({},{}),null);
 assert.equal(await context({auth:{...auth,getSession:async()=>({data:{session:null}})}})({},{}),null);
});
