// Run with trusted local environment files. Never prints credentials or session tokens.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='https://www.sharps-signal.com';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const service=process.env.SUPABASE_SERVICE_ROLE;
const stripeKey=process.env.STRIPE_TEST_SECRET_KEY;
assert(url?.includes('npoanpbmkglupulcklcg')&&service&&stripeKey?.startsWith('sk_test_'));
const report={verified_at:new Date().toISOString(),origin,mode:'test',checks:[]};
let session;
const read=async(r)=>{const d=await r.json();assert(r.ok,'HTTP '+r.status+' '+(d.error?.code||d.error||'request_failed'));return d;};
const db=path=>fetch(url+'/rest/v1/'+path,{headers:{apikey:service,Authorization:'Bearer '+service}}).then(read);
const stripe=path=>fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+stripeKey}}).then(read);
const auth=(path,body)=>fetch(url+'/auth/v1/'+path,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(read);
async function main(){
 const anon=await fetch(origin+'/api/admin/pick-refunds');assert.equal(anon.status,403);
 assert.equal((await fetch(origin+'/api/pick-shop?mode=test')).status,403);report.checks.push('Anonymous admin and sandbox access denied');
 const link=await auth('admin/generate_link',{type:'magiclink',email:'sharpssignal@gmail.com'});
 session=await auth('verify',{type:'magiclink',token_hash:link.hashed_token});
 const value=encodeURIComponent(JSON.stringify([session.access_token,session.refresh_token,null,null,null]));
 const parts=[];for(let i=0;i<value.length;i+=3180)parts.push(value.slice(i,i+3180));
 const name='sb-npoanpbmkglupulcklcg-auth-token';
 const cookie=parts.map((v,i)=>(parts.length===1?name:name+'.'+i)+'='+v).join('; ');
 const api=(path,body,requestOrigin=origin)=>fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:requestOrigin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const post=body=>api('/api/admin/pick-refunds',{mode:'test',...body}).then(read);
 assert.equal((await api('/api/admin/pick-refunds',{mode:'test',action:'test_purchase'},'https://untrusted.example')).status,403);report.checks.push('Foreign-origin refund mutation denied');
 const state=await api('/api/admin/pick-refunds?mode=test').then(read);assert.equal(state.configured,true);
 const account=await stripe('account');assert.equal(account.id,'acct_1RecgmQvST8YtIYC');report.stripe_account=account.id;
 let id=process.argv[2];
 if(id&&process.argv.includes('--reconcile'))await post({action:'refund',purchase_id:id});
 if(!id){const p=await post({action:'test_purchase'});id=p.purchase_id;assert(id);const preview=await post({action:'preview',purchase_id:id});assert.equal(preview.amount_cents,500);const result=await post({action:'refund',purchase_id:id});assert.equal(result.status,'succeeded');report.checks.push('Manual API $5 sandbox purchase, preview and refund succeeded');}
 const purchases=await db('pick_fee_purchases?id=eq.'+id);const p=purchases[0];assert(p&&p.billing_mode==='test'&&p.qa_test===true);assert.equal(p.status,'refunded');
 const claims=await db('pick_fee_refund_claims?purchase_id=eq.'+id);assert.equal(claims.length,1);const c=claims[0];assert.equal(c.status,'succeeded');assert.equal(c.amount_cents,500);
 const payment=await stripe('payment_intents/'+p.payment_intent_id+'?expand[]=latest_charge');assert.equal(payment.livemode,false);assert.equal(payment.amount_received,500);assert.equal(payment.latest_charge.amount_refunded,500);assert.equal(payment.latest_charge.refunded,true);
 const refunds=await stripe('refunds?payment_intent='+p.payment_intent_id);assert.equal(refunds.data.length,1);assert.equal(refunds.data[0].id,c.stripe_refund_id);assert.equal(refunds.data[0].status,'succeeded');assert.equal(refunds.data[0].charge,payment.latest_charge.id);
 const replays=await Promise.all([post({action:'refund',purchase_id:id}),post({action:'refund',purchase_id:id})]);for(const replay of replays)assert.equal(replay.stripe_refund_id,c.stripe_refund_id);
 const events=await db('pick_fee_refund_events?purchase_id=eq.'+id);assert.equal(events.filter(e=>e.event_type==='refund_succeeded').length,1);assert.equal((await stripe('refunds?payment_intent='+p.payment_intent_id)).data.length,1);
 const wrong=await api('/api/admin/pick-refunds',{mode:'live',action:'preview',purchase_id:id});assert.equal(wrong.status,400);assert.equal((await wrong.json()).error,'purchase_not_found');
 const order=await api('/api/pick-orders/'+id).then(read);assert(!order.selection);
 const live=await api('/api/admin/pick-refunds?mode=live').then(read);assert(!live.purchases.some(row=>row.id===id));
 report.purchase_id=id;report.payment_intent_id=p.payment_intent_id;report.stripe_refund_id=c.stripe_refund_id;report.amount_cents=500;report.owner_verification=p.owner_verification;report.events=events.map(e=>e.event_type);
 report.checks.push('Stripe confirms one successful full $5 test refund','Ledger and claim are refunded with exactly one success audit event','Concurrent duplicate requests reuse the same refund','Test purchase is inaccessible through live mode and absent from live ledger','Refunded selection is no longer revealed');report.passed=true;
}
main().catch(e=>{report.passed=false;report.error=e.message;process.exitCode=1}).finally(async()=>{if(session?.access_token)await fetch(url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+session.access_token}});fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/sandbox-refund-'+(report.purchase_id||'failed')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
