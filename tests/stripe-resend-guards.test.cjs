const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('scripts/resend-stripe-recovery.cjs','utf8').replace(/main\(\)\.catch\([\s\S]*$/,'main');
function fixture({pending=0,now='2026-11-11T22:00:00Z',account='acct_1RecgUJRsCJh7NlT',args=['node','script','--apply']}={}){
 let calls=0;const process={argv:args,env:{STRIPE_SECRET_KEY:'fixture'}};
 class Stripe{constructor(){this.accounts={retrieve:async()=>({id:account})};this.webhookEndpoints={retrieve:async()=>({livemode:true,status:'enabled',url:'https://www.sharps-signal.com/api/webhooks/stripe'})};this.events={retrieve:async id=>({id,livemode:true,type:'invoice.paid',pending_webhooks:pending})};}}
 const main=vm.runInNewContext(code,{require:name=>name==='stripe'?Stripe:{spawnSync:()=>{calls++;return {status:0};}},process,Date:{now:()=>Date.parse(now),parse:Date.parse},console:{log(){},error(){}}});
 return {run:main,count:()=>calls};
}
test('delivered events are skipped on a repeated recovery run',async()=>{const f=fixture();await f.run();assert.equal(f.count(),0);});
test('only the four pinned failed events can be resent',async()=>{const f=fixture({pending:1});await f.run();assert.equal(f.count(),4);});
test('expiry, missing apply, wrong account and multiple destinations prevent resends',async()=>{
 for(const options of [{now:'2026-11-12T00:00:00Z'},{args:['node','script']},{account:'wrong'},{pending:2}]){const f=fixture(options);await assert.rejects(f.run());assert.equal(f.count(),0);}
});
