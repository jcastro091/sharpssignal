const test=require('node:test'),assert=require('node:assert/strict');
const {proposal,initiate}=require('../lib/pickRefund.cjs');
function fixture(){
 const purchase={id:'order1',pick_id:'pick1',user_id:'buyer1',product_type:'pick',guarantee_version:'pick_fee_loss_v1',payment_intent_id:'pi_1',amount_paid_cents:500,currency:'usd',billing_mode:'live',qa_test:false};
 const settlement={pick_id:'pick1',billing_mode:'live',verified:true,status:'final',result:'loss',evidence_hash:'score-hash'};
 const payment={id:'pi_1',livemode:true,status:'succeeded',amount_received:500,currency:'usd',metadata:{purchase_id:'order1',pick_id:'pick1',user_id:'buyer1'},latest_charge:{captured:true,disputed:false,amount_refunded:0}};
 return {purchase,settlement,payment};
}
test('refund equals actual pick purchase price, ignoring any wager stake',()=>{
 const f=fixture();f.purchase.wager_stake_cents=100000;assert.equal(proposal(...Object.values(f)).amount_cents,500);
});
test('partial and completed refunds cannot exceed original fee',()=>{
 const f=fixture();f.payment.latest_charge.amount_refunded=200;assert.equal(proposal(...Object.values(f)).amount_cents,300);
 f.payment.latest_charge.amount_refunded=500;assert.equal(proposal(...Object.values(f)).amount_cents,0);
});
test('wins, open games, pushes, voids and unverified or wrong settlements are rejected',()=>{
 for(const result of ['win','pending','push','void']){const f=fixture();f.settlement.result=result;assert.throws(()=>proposal(...Object.values(f)));}
 for(const mutate of [f=>f.settlement.verified=false,f=>f.settlement.pick_id='other',f=>f.settlement.status='open',f=>delete f.settlement.evidence_hash]){const f=fixture();mutate(f);assert.throws(()=>proposal(...Object.values(f)));}
});
test('subscriptions, QA purchases, absent guarantee, foreign payments and disputes are rejected',()=>{
 for(const mutate of [f=>f.purchase.product_type='subscription',f=>f.purchase.qa_test=true,f=>delete f.purchase.guarantee_version,f=>f.payment.metadata.user_id='other',f=>f.payment.currency='eur',f=>f.payment.amount_received=100,f=>f.payment.status='processing',f=>f.payment.latest_charge.disputed=true,f=>f.payment.latest_charge.captured=false,f=>f.payment.latest_charge.amount_refunded=-1]){const f=fixture();mutate(f);assert.throws(()=>proposal(...Object.values(f)));}
});
test('admin initiation reserves and audits refund and uses a durable idempotency key',async()=>{
 const f=fixture();let calls=0,complete=0;const keys=[];
 const store={isAdmin:async id=>id==='admin',purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>null,claim:async()=>({id:'claim1',amount_cents:500,evidence_hash:'score-hash',created_at:new Date().toISOString()}),complete:async()=>complete++};
 const stripe={paymentIntents:{retrieve:async()=>f.payment},refunds:{list:async()=>({data:[]}),create:async(body,opts)=>{calls++;keys.push(opts.idempotencyKey);assert.equal(body.amount,500);return {id:'re_1',payment_intent:'pi_1',livemode:true,amount:500,currency:'usd',status:'succeeded'};}}};
 await assert.rejects(initiate({purchaseId:'order1',adminId:'buyer',store,stripe}),/admin_required/);assert.equal(calls,0);
 await initiate({purchaseId:'order1',adminId:'admin',store,stripe});await initiate({purchaseId:'order1',adminId:'admin',store,stripe});
 assert.deepEqual(keys,['pick-fee-refund:claim1','pick-fee-refund:claim1']);assert.equal(complete,2);
});
test('failed audit reservation never reaches the payment provider',async()=>{
 const f=fixture();let called=false;
 await assert.rejects(initiate({purchaseId:'order1',adminId:'admin',store:{isAdmin:async()=>true,purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>null,claim:async()=>{throw Error('storage_offline')}},stripe:{paymentIntents:{retrieve:async()=>f.payment},refunds:{list:async()=>({data:[]}),create:async()=>{called=true}}}}));assert.equal(called,false);
});
test('retry after completion-write failure reuses the provider key and creates one refund',async()=>{
 const f=fixture();let writes=0,created=0;const refunds=new Map();
 const store={isAdmin:async()=>true,purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>null,claim:async()=>({id:'claim1',amount_cents:500,evidence_hash:'score-hash',created_at:new Date().toISOString()}),complete:async()=>{if(++writes===1)throw Error('audit_offline')}};
 const stripe={paymentIntents:{retrieve:async()=>f.payment},refunds:{list:async()=>({data:[]}),create:async(body,opts)=>{if(!refunds.has(opts.idempotencyKey)){created++;refunds.set(opts.idempotencyKey,{id:'re_1',payment_intent:'pi_1',livemode:true,amount:500,currency:'usd',status:'pending'});}return refunds.get(opts.idempotencyKey);}}};
 await assert.rejects(initiate({purchaseId:'order1',adminId:'admin',store,stripe}),/audit_offline/);
 const result=await initiate({purchaseId:'order1',adminId:'admin',store,stripe});assert.equal(result.status,'pending');assert.equal(created,1);
});
test('reconciles provider success after local write failure even when fully refunded',async()=>{
 const f=fixture();f.payment.latest_charge.amount_refunded=500;let created=0,written=0;
 const claim={id:'claim1',amount_cents:500,evidence_hash:'score-hash',created_at:new Date().toISOString()};
 const refund={id:'re_1',payment_intent:'pi_1',livemode:true,amount:500,currency:'usd',status:'succeeded',metadata:{claim_id:'claim1'}};
 const store={isAdmin:async()=>true,purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>claim,complete:async()=>written++};
 const stripe={paymentIntents:{retrieve:async()=>f.payment},refunds:{list:async()=>({data:[refund]}),create:async()=>{created++}}};
 const r=await initiate({purchaseId:'order1',adminId:'admin',store,stripe});assert.equal(r.status,'succeeded');assert.equal(created,0);assert.equal(written,1);
});
test('refresh does not start an unrequested refund',async()=>{
 const f=fixture();let created=0;
 const store={isAdmin:async()=>true,purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>null};
 const stripe={paymentIntents:{retrieve:async()=>f.payment},refunds:{create:async()=>created++}};
 const r=await initiate({purchaseId:'order1',adminId:'admin',store,stripe,refreshOnly:true});assert.equal(r.status,'not_requested');assert.equal(created,0);
});
test('expired provider idempotency window requires reconciliation rather than a new refund',async()=>{
 const f=fixture();let created=0;
 const store={isAdmin:async()=>true,purchase:async()=>f.purchase,settlement:async()=>f.settlement,existingClaim:async()=>({id:'claim1',amount_cents:500,evidence_hash:'score-hash',created_at:new Date(Date.now()-24*3600000).toISOString()})};
 const stripe={paymentIntents:{retrieve:async()=>f.payment},refunds:{create:async()=>created++}};
 await assert.rejects(initiate({purchaseId:'order1',adminId:'admin',store,stripe}),/refund_requires_reconciliation/);assert.equal(created,0);
});
test('test and live payments cannot cross billing modes',()=>{
 const f=fixture();f.payment.livemode=false;assert.throws(()=>proposal(...Object.values(f)),/payment_binding_mismatch/);
 f.purchase.billing_mode='test';f.purchase.qa_test=true;f.settlement.billing_mode='test';assert.equal(proposal(...Object.values(f)).amount_cents,500);
 f.settlement.billing_mode='live';assert.throws(()=>proposal(...Object.values(f)),/verified_losing_pick_required/);
});
