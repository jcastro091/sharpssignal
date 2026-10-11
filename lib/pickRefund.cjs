function requireValue(condition, code) { if (!condition) throw Error(code); }
function proposal(p, s, payment) {
 requireValue(p?.product_type==='pick' && p.guarantee_version==='pick_fee_loss_v1','not_a_guaranteed_pick');
 requireValue(s?.pick_id===p.pick_id && s.billing_mode===p.billing_mode && s.verified===true && s.status==='final' && s.result==='loss' && s.evidence_hash,'verified_losing_pick_required');
 requireValue(payment?.id===p.payment_intent_id && payment.status==='succeeded' && payment.currency===p.currency && payment.amount_received===p.amount_paid_cents && payment.livemode===(p.billing_mode==='live') && p.qa_test===(p.billing_mode==='test') && payment.metadata?.purchase_id===p.id && payment.metadata?.pick_id===p.pick_id && payment.metadata?.user_id===p.user_id,'payment_binding_mismatch');
 requireValue(payment.latest_charge?.captured===true && !payment.latest_charge.disputed,'captured_undisputed_payment_required');
 const paid=p.amount_paid_cents, refunded=payment.latest_charge.amount_refunded;
 requireValue(Number.isSafeInteger(paid)&&paid>0&&Number.isSafeInteger(refunded)&&refunded>=0&&refunded<=paid,'invalid_refund_amount');
 return {purchase_id:p.id,pick_id:p.pick_id,currency:p.currency,amount_cents:paid-refunded,already_refunded_cents:refunded,payment_intent:payment.id,policy:p.guarantee_version};
}
async function initiate({purchaseId,adminId,store,stripe,previewOnly=false,refreshOnly=false}) {
 requireValue(adminId&&await store.isAdmin(adminId),'admin_required');
 const p=await store.purchase(purchaseId); requireValue(p,'purchase_not_found');
 const s=await store.settlement(p.pick_id,p.billing_mode);
 let payment=await stripe.paymentIntents.retrieve(p.payment_intent_id,{expand:['latest_charge']});
 const preview=proposal(p,s,payment);
 if(previewOnly) return preview;
 let claim=await store.existingClaim(p.id);
 if(refreshOnly&&!claim) return {...preview,status:"not_requested"};
 if(!claim && !preview.amount_cents) return {...preview,status:'already_refunded'};
 if(!claim) claim=await store.claim({purchase_id:p.id,admin_id:adminId,amount_cents:preview.amount_cents,evidence_hash:s.evidence_hash});
 requireValue(claim?.id&&claim.evidence_hash===s.evidence_hash,'refund_claim_conflict');
 let refund;
 if(claim.stripe_refund_id) refund=await stripe.refunds.retrieve(claim.stripe_refund_id);
 else {
  requireValue(Date.now()-Date.parse(claim.created_at)<23*3600000,'refund_requires_reconciliation');
  // Recover a provider success followed by a database write failure before creating anything.
  const previous=await stripe.refunds.list({payment_intent:payment.id,limit:100});
  refund=previous.data.find(r=>r.metadata?.claim_id===claim.id);
  if(!refund) {
   requireValue(claim.amount_cents===preview.amount_cents,'refund_requires_reconciliation');
   refund=await stripe.refunds.create({payment_intent:payment.id,amount:claim.amount_cents,metadata:{purchase_id:p.id,pick_id:p.pick_id,claim_id:claim.id,policy:preview.policy,admin_id:adminId}},{idempotencyKey:'pick-fee-refund:'+claim.id});
  }
 }
 // Stripe Refund objects do not expose livemode. Mode is verified on the
 // PaymentIntent above; bind this response to that exact payment and charge.
 requireValue(refund?.id&&refund.amount===claim.amount_cents&&refund.currency===p.currency&&refund.payment_intent===p.payment_intent_id&&refund.charge===payment.latest_charge.id,'refund_response_mismatch');
 payment=await stripe.paymentIntents.retrieve(p.payment_intent_id,{expand:['latest_charge']});
 await store.complete(claim.id,{stripe_refund_id:refund.id,status:refund.status,amount:refund.amount,total_refunded:payment.latest_charge.amount_refunded,currency:refund.currency,failure_code:refund.failure_reason||null});
 return {...preview,amount_cents:refund.amount,stripe_refund_id:refund.id,status:refund.status};
}
module.exports={proposal,initiate};
