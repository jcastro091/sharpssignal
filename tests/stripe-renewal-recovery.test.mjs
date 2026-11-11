import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createStripeWebhookStore} from '../lib/stripeWebhookStore.mjs';
const {processStripeEvent}=await import('data:text/javascript,'+encodeURIComponent(await fs.readFile('lib/stripeWebhook.js','utf8')));
function database(tables) {
 return {from(table){const filters=[];return {select(){return this;},eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){const rows=(tables[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));return rows.length>1?{error:Error('ambiguous')}:{data:rows[0]||null};},async upsert(value){if(!(tables[table]||=[]).some(r=>r.event_id===value.event_id))tables[table].push(value);return {};}};},auth:{admin:{getUserById:async id=>({data:{user:{id}}})}},async rpc(_,{payload}){(tables.applied||=[]).push(payload);return {data:{outcome:'applied'}};}};
}
const base={id:'sub_managed',customer:'cus_bound',status:'active',metadata:{user_id:'user_bound',plan:'pro_telegram'},
 latest_invoice:{status:'paid',customer:'cus_bound',subscription:'sub_managed'},items:{has_more:false,data:[{subscription:'sub_managed',current_period_end:2000000000}]}};
function provider(subscription) {return {subscriptions:{retrieve:async()=>subscription},checkout:{sessions:{retrieve:async()=>({id:'cs_legacy',livemode:true,mode:'subscription',status:'complete',payment_status:'paid',subscription:subscription.id,customer:subscription.customer,metadata:{}})}}};}
function event(subscription,type='invoice.paid'){return {id:'evt_renewal',created:100,type,data:{object:type==='invoice.paid'?{id:'in_paid',customer:subscription.customer,subscription:subscription.id}:{...subscription}}};}
test('renewal initializes legacy ledger only from verified live checkout binding',async()=>{
 const tables={customer_entitlements:[{stripe_subscription_id:'sub_managed',stripe_customer_id:'cus_bound',user_id:'user_bound',stripe_session_id:'cs_verified',billing_mode:'live',qa_test:false,plan:'pro_telegram'}]};
 const result=await processStripeEvent(event(base),'hash',{stripe:provider(base),store:createStripeWebhookStore(database(tables))});
 assert.equal(result.outcome,'applied');assert.equal(tables.applied[0].user_id,'user_bound');assert.equal(tables.applied[0].stripe_checkout_session_id,'cs_verified');
});
test('ambiguous or mismatched bindings fail without access changes',async()=>{
 for(const rows of [
  [{stripe_subscription_id:'sub_managed',stripe_customer_id:'wrong',user_id:'user_bound',stripe_session_id:'cs_verified',billing_mode:'live',qa_test:false,plan:'pro_telegram'}],
  Array(2).fill({stripe_subscription_id:'sub_managed',billing_mode:'live',qa_test:false})
 ]){const tables={customer_entitlements:rows};await assert.rejects(processStripeEvent(event(base),'hash',{stripe:provider(base),store:createStripeWebhookStore(database(tables))}));assert.equal(tables.applied,undefined);}
});
test('only verified unmapped legacy checkout is durably queued and never grants access',async()=>{
 const subscription={...base,metadata:{}};
 const tables={subscriptions:[{stripe_subscription_id:subscription.id,stripe_customer_id:subscription.customer,user_id:null,plan:null,stripe_checkout_session_id:'cs_legacy'}]};
 const store=createStripeWebhookStore(database(tables)),stripe=provider(subscription);
 assert.equal((await processStripeEvent(event(subscription),'hash',{stripe,store})).outcome,'review_required');
 assert.equal(tables.stripe_webhook_review.length,1);assert.equal(tables.applied,undefined);
 assert.equal((await processStripeEvent(event(subscription),'hash',{stripe,store})).outcome,'duplicate');
 await assert.rejects(processStripeEvent(event(subscription),'changed',{stripe,store}),/replay_conflict/);
});
test('review storage or provider failure remains retriable',async()=>{
 const subscription={...base,metadata:{}};
 const existing={stripe_customer_id:subscription.customer,stripe_checkout_session_id:'cs_legacy'};
 for(const fail of ['store','provider']) {
  const stripe=provider(subscription);if(fail==='provider')stripe.checkout.sessions.retrieve=async()=>{throw Error('outage');};
  const store={event:async()=>null,subscription:async()=>existing,recordUnmapped:async()=>{throw Error('storage');}};
  await assert.rejects(processStripeEvent(event(subscription),'hash',{stripe,store}));
 }
});
