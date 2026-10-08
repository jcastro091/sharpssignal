const test=require('node:test'),assert=require('node:assert/strict');
const {paidQAReceipt,verifiedQAGrant,paidInvite}=require('../lib/realtimeBilling.cjs');
const now=Date.parse('2026-10-08T16:00:00Z');
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
 const grant={user_id:'owner',billing_mode:'live',verified_at:new Date(now).toISOString(),status:'paid',stripe_session_id:'cs_live_abc',valid_until:new Date(now+1800000).toISOString(),qa_test:false};
 await assert.rejects(()=>paidInvite({grant:null,send}),/payment/);assert.equal(sent.length,0);
 await assert.rejects(()=>paidInvite({grant,telegramUserId:'123',chatId:'private',now,send:async()=>({type:'channel',username:'public'})}),/private/);
 await assert.rejects(()=>paidInvite({grant,telegramUserId:'123',chatId:'private',now,send,supabase:{from:()=>({insert:async()=>({error:true})})}}),/recorded/);
 assert.deepEqual(sent,['getChat','createChatInviteLink','revokeChatInviteLink']);
});
