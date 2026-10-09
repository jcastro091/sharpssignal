const test=require('node:test'),assert=require('node:assert/strict');
const {paidQAReceipt,verifiedQAGrant,paidInvite}=require('../lib/realtimeBilling.cjs');
const now=Date.parse('2026-10-08T16:00:00Z');
const routingEnv={PRO_CHAT_ID:'-100',MARKET_SHADOW_TELEGRAM_CHAT_ID:'-200',OPS_TELEGRAM_CHAT_ID:'-300',BUSINESS_TELEGRAM_CHAT_ID:'-400'};
function session(){return {id:'cs_live_abc',metadata:{user_id:'owner',plan:'qa_realtime',qa_test:'true'},livemode:true,mode:'payment',status:'complete',payment_status:'paid',amount_total:100,currency:'usd',customer:'cus_owner',payment_intent:{id:'pi_owner',status:'succeeded',livemode:true,amount:100,amount_received:100,currency:'usd',customer:'cus_owner',metadata:{user_id:'owner'},latest_charge:{created:now/1000,id:'ch_owner',payment_intent:'pi_owner',customer:'cus_owner',livemode:true,paid:true,captured:true,amount:100,currency:'usd',amount_refunded:0,refunded:false,disputed:false}}};}
test('a completed captured $1 receipt grants exactly 30 minutes; replay does not extend the expiry',()=>{
 const s=session(),grant=paidQAReceipt(s,'owner',now);assert.equal(grant.valid_until,new Date(now+1800000).toISOString());
 assert.equal(paidQAReceipt(s,'owner',now+60000).valid_until,grant.valid_until);assert.equal(grant.qa_test,true);
});
test('unpaid checkout, foreign owner, holds, refunds, disputes, wrong amount and test mode cannot grant live access',()=>{
 const mutations=[s=>s.payment_status='unpaid',s=>s.metadata.user_id='other',s=>s.livemode=false,s=>s.amount_total=101,
  s=>s.payment_intent.status='requires_capture',s=>s.payment_intent.latest_charge.captured=false,
  s=>s.payment_intent.latest_charge.amount_refunded=1,s=>s.payment_intent.latest_charge.disputed=true,
  s=>s.payment_intent.customer='cus_other',s=>s.payment_intent.latest_charge.payment_intent='pi_other'];
 for(const mutate of mutations){const s=session();mutate(s);assert.throws(()=>paidQAReceipt(s,'owner',now));}
});
test('verifier retrieves current provider evidence; client account fields cannot replace the owner',async()=>{
 let calls=0;const stripe={checkout:{sessions:{retrieve:async()=>{calls++;return session();}}}};
 await assert.rejects(()=>verifiedQAGrant(stripe,{},'cs_live_abc','other',now),/owner/);assert.equal(calls,1);
});
test('Telegram invite requires payment and a private channel; failed persistence revokes the unused link',async()=>{
 const sent=[];const send=async(method)=>{sent.push(method);return method==='getChat'?{type:'channel'}:{invite_link:'https://t.me/+private',expire_date:now/1000+600};};
 const grant={user_id:'owner',plan:'pro_telegram',products:['sports'],billing_mode:'live',verified_at:new Date(now).toISOString(),status:'paid',stripe_session_id:'cs_live_abc',valid_until:new Date(now+1800000).toISOString(),qa_test:false};
 await assert.rejects(()=>paidInvite({grant:null,send}),/payment/);assert.equal(sent.length,0);
 await assert.rejects(()=>paidInvite({grant,telegramUserId:'123',chatId:'-100',product:'sports',env:routingEnv,now,send:async()=>({type:'channel',username:'public'})}),/private/);
 await assert.rejects(()=>paidInvite({grant,telegramUserId:'123',chatId:'-100',product:'sports',env:routingEnv,now,send,supabase:{from:()=>({insert:async()=>({error:true})})}}),/recorded/);
 assert.deepEqual(sent,['getChat','createChatInviteLink','revokeChatInviteLink']);
});
const {verifiedSubscriptionGrant}=require('../lib/realtimeBilling.cjs');
const {refreshCustomerAccess}=require('../lib/realtimeBilling.cjs');
function subscriptionFixture(){
 const checkout={id:'cs_live_paid',metadata:{user_id:'owner',plan:'pro_telegram'},livemode:true,mode:'subscription',status:'complete',payment_status:'paid',customer:'cus_owner',subscription:'sub_owner'};
 const invoice={id:'in_owner',livemode:true,status:'paid',amount_paid:2000,currency:'usd',customer:'cus_owner',parent:{subscription_details:{subscription:'sub_owner'}}};
 const subscription={id:'sub_owner',customer:'cus_owner',livemode:true,status:'active',metadata:checkout.metadata,latest_invoice:invoice,items:{has_more:false,data:[{subscription:'sub_owner',current_period_end:now/1000+3600}]}};
 const payment={livemode:true,status:'paid',amount_paid:2000,currency:'usd',invoice:'in_owner',payment:{type:'payment_intent',payment_intent:'pi_owner'}};
 const intent={...session().payment_intent,amount:2000,amount_received:2000,latest_charge:{...session().payment_intent.latest_charge,amount:2000}};
 const stripe={checkout:{sessions:{retrieve:async()=>checkout}},subscriptions:{retrieve:async()=>subscription},invoicePayments:{list:async()=>({has_more:false,data:[payment]})},paymentIntents:{retrieve:async()=>intent}};
 return {checkout,invoice,subscription,payment,intent,stripe};
}
test('normal paid subscriptions require the invoice payment and captured unrefunded charge before grant persistence',async()=>{
 const f=subscriptionFixture();let written;const supabase={rpc:async(name,args)=>{written=args.payment;return {data:written};}};
 const grant=await verifiedSubscriptionGrant(f.stripe,supabase,'cs_live_paid','owner',now);
 assert.equal(grant.qa_test,false);assert.equal(grant.stripe_subscription_id,'sub_owner');assert.equal(written.amount_cents,2000);
});
test('expired cached subscriptions recheck a real renewal; expired QA grants and unpaid renewals grant nothing',async()=>{
 const row={stripe_session_id:'cs_live_paid',qa_test:false,valid_until:new Date(now-1).toISOString()};
 let writes=0;
 const query={select(){return this;},eq(){return this;},is(){return Promise.resolve({data:[row]});}};
 const supabase={from:()=>query,rpc:async(name,args)=>{writes++;return {data:args.payment};}};
 const f=subscriptionFixture();
 const grant=await refreshCustomerAccess(f.stripe,supabase,'owner',now);
 assert.equal(Date.parse(grant.valid_until),now+3600000);assert.equal(writes,1);
 row.qa_test=true;assert.equal(await refreshCustomerAccess({},supabase,'owner',now),null);
 row.qa_test=false;f.invoice.status='open';
 let revoked=false;query.update=()=>({eq:async()=>{revoked=true;return {};}});
 assert.equal(await refreshCustomerAccess(f.stripe,supabase,'owner',now),null);
 assert.equal(revoked,true);assert.equal(writes,1);
});
test('trial, fake or refunded invoice payments and mismatched subscription periods cannot grant paid access',async()=>{
 const mutations=[f=>f.subscription.status='trialing',f=>f.checkout.metadata={user_id:'other',plan:'pro_telegram'},f=>f.invoice.amount_paid=0,f=>f.invoice.status='open',f=>f.payment.invoice='in_other',f=>f.intent.latest_charge.amount_refunded=1,f=>f.intent.latest_charge.disputed=true,f=>f.subscription.items.has_more=true,f=>f.subscription.items.data[0].subscription='sub_other',f=>f.subscription.items.data[0].current_period_end=now/1000];
 for(const mutate of mutations){const f=subscriptionFixture();mutate(f);let writes=0;await assert.rejects(()=>verifiedSubscriptionGrant(f.stripe,{rpc:async()=>{writes++;return {}; }},'cs_live_paid','owner',now));assert.equal(writes,0);}
});
const {admissionAuthorized,handleMembership}=require('../lib/telegramMembership.cjs');
test('Markets-only and both: verify payment, persist product grants, issue only paid invites, and admit the linked account',async()=>{
 process.env.STRIPE_PRICE_PRO_TELEGRAM='price_existing';
 for(const selected of [['markets'],['sports','markets']]) {
  const f=subscriptionFixture();f.checkout.metadata={...f.checkout.metadata,products:selected.join(','),price_id:'price_existing'};f.subscription.metadata={...f.checkout.metadata};
  f.subscription.items.data[0].price={id:'price_existing'};f.subscription.items.data[0].quantity=selected.length;
  const amount=2000*selected.length;f.invoice.amount_paid=amount;f.payment.amount_paid=amount;f.intent.amount_received=amount;f.intent.latest_charge.amount=amount;
  const state={grants:[],invites:[],members:[]},calls=[];
  const supabase={rpc:async(_,args)=>{state.grants=[args.payment];return {data:args.payment};},from(table){let filters=[];return {
   select(){return this;},eq(k,v){filters.push([k,v]);return this;},is(){return Promise.resolve({data:state.grants});},
   maybeSingle:async()=>({data:state.invites.find(r=>filters.every(([k,v])=>r[k]===v))}),
   insert:async r=>{state.invites.push(r);return {};},upsert:async r=>{state.members.push(r);return {};},
   update:()=>({eq:()=>({eq:async()=>({}),then:r=>r({})})})
  };}};
  const send=async(method,body)=>{calls.push({method,body});return method==='getChat'?{type:'channel'}:method==='createChatInviteLink'?{invite_link:'https://t.me/+TEST-'+body.chat_id,expire_date:now/1000+600}:true;};
  const grant=await verifiedSubscriptionGrant(f.stripe,supabase,'cs_live_paid','owner',now);
  assert.deepEqual(grant.products,selected);assert.equal(grant.amount_cents,amount);
  for(const product of ['sports','markets']) {
   const chatId=product==='sports'?'-100':'-200';
   if(!selected.includes(product)){await assert.rejects(()=>paidInvite({supabase,grant,telegramUserId:'123',chatId,product,env:routingEnv,send,now}),/product_payment_required/);continue;}
   const url=await paidInvite({supabase,grant,telegramUserId:'123',chatId,product,env:routingEnv,send,now});
   const result=await handleMembership({chat_join_request:{chat:{id:chatId},from:{id:123},invite_link:{invite_link:url}}},{stripe:f.stripe,supabase,env:routingEnv,send,now});
   assert.equal(result.admitted,true);
  }
  assert.deepEqual(calls.filter(c=>c.method==='approveChatJoinRequest').map(c=>c.body.chat_id),selected.map(p=>p==='sports'?'-100':'-200'));
  const other=selected.length===1?'sports':null;
  if(other){const forged={invite_hash:require('node:crypto').createHash('sha256').update('https://t.me/+forged').digest('hex'),user_id:'owner',telegram_user_id:'123',chat_id:'-100',stripe_session_id:grant.stripe_session_id,expires_at:new Date(now+10000).toISOString()};state.invites.push(forged);const result=await handleMembership({chat_join_request:{chat:{id:'-100'},from:{id:123},invite_link:{invite_link:'https://t.me/+forged'}}},{stripe:f.stripe,supabase,env:routingEnv,send,now});assert.equal(Boolean(result.admitted),false);}
 }
});
test('tampered products, quantity, price, and mismatched subscription metadata cannot grant access',async()=>{
 process.env.STRIPE_PRICE_PRO_TELEGRAM='price_existing';
 for(const mutate of [f=>f.subscription.items.data[0].quantity=1,f=>f.subscription.metadata.products='markets',f=>f.subscription.items.data[0].price.id='price_other',f=>f.checkout.metadata.products='operations']){
  const f=subscriptionFixture();f.checkout.metadata={...f.checkout.metadata,products:'sports,markets',price_id:'price_existing'};f.subscription.metadata={...f.checkout.metadata};Object.assign(f.subscription.items.data[0],{price:{id:'price_existing'},quantity:2});mutate(f);
  await assert.rejects(()=>verifiedSubscriptionGrant(f.stripe,{rpc:()=>assert.fail('must not persist')},'cs_live_paid','owner',now));
 }
});
test('Telegram admission accepts only a server signature; a paid-looking foreign, expired or QA invite is declined',async()=>{
 assert.equal(admissionAuthorized({headers:{}},'server-key'),false);
 const token=require('node:crypto').createHmac('sha256','server-key').update('sharpssignal-telegram-admission-v1').digest('hex');
 assert.equal(admissionAuthorized({headers:{'x-telegram-admission-token':token}},'server-key'),true);
 for(const invite of [{telegram_user_id:'other',expires_at:new Date(now+10000).toISOString()},{telegram_user_id:'123',expires_at:new Date(now-1).toISOString()},{telegram_user_id:'123',expires_at:new Date(now+10000).toISOString(),qa_test:true}]){
  const calls=[],record={...invite,chat_id:'-100',user_id:'owner'};
  const supabase={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:record})})};
  const result=await handleMembership({chat_join_request:{chat:{id:'-100'},from:{id:123},invite_link:{invite_link:'https://t.me/+private'}}},{stripe:{},supabase,env:routingEnv,now,send:async(method)=>calls.push(method)});
  assert.equal(result.admitted,false);assert.deepEqual(calls,['declineChatJoinRequest']);
 }
});
