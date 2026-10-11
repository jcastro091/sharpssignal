import Stripe from 'stripe';
import {createSupabaseServiceClient} from './supabaseServer';
import {paidEvidence} from './pickCommerce.cjs';
export function commerceStripe(mode,options={}){
 const key=mode==='test'?process.env.STRIPE_TEST_SECRET_KEY:process.env.STRIPE_SECRET_KEY;
 if(!key?.startsWith(mode==='test'?'sk_test_':'sk_live_'))throw Error(mode==='test'?'stripe_test_key_required':'stripe_live_key_required');
 return new Stripe(key,{apiVersion:'2025-06-30.basil',timeout:12000,maxNetworkRetries:1,...options});
}
export async function dbResult(p){const r=await p;if(r.error)throw Error('commerce_storage_unavailable');return r.data;}
export function refundStore(db,authorizedId){return {
 isAdmin:async id=>id===authorizedId,
 purchase:id=>dbResult(db.from('pick_fee_purchases').select('*').eq('id',id).maybeSingle()),
 settlement:(id,mode)=>dbResult(db.from('pick_fee_settlements').select('*').eq('pick_id',id).eq('billing_mode',mode).maybeSingle()),
 existingClaim:id=>dbResult(db.from('pick_fee_refund_claims').select('*').eq('purchase_id',id).maybeSingle()),
 claim:c=>dbResult(db.rpc('reserve_pick_fee_refund',{p_purchase_id:c.purchase_id,p_admin_id:c.admin_id,p_amount:c.amount_cents,p_evidence_hash:c.evidence_hash})),
 complete:(id,r)=>dbResult(db.rpc('complete_pick_fee_refund',{p_claim_id:id,p_refund_id:r.stripe_refund_id,p_status:r.status,p_amount:r.amount,p_total_refunded:r.total_refunded,p_currency:r.currency,p_failure_code:r.failure_code}))
};}
export async function verifyPickSession(sessionId,userId,mode){
 const db=createSupabaseServiceClient(),stripe=commerceStripe(mode);
 const session=await stripe.checkout.sessions.retrieve(sessionId);
 if(session.metadata?.user_id!==userId||session.metadata?.product_type!=='pick')throw Error('payment_binding_mismatch');
 const order=await dbResult(db.from('pick_fee_orders').select('*').eq('id',session.metadata.purchase_id).eq('user_id',userId).maybeSingle());
 if(!order)throw Error('order_not_found');
 const offer=await dbResult(db.from('pick_fee_offers').select('*').eq('id',order.offer_id).maybeSingle());
 if(!offer||offer.billing_mode!==mode)throw Error('payment_mode_mismatch');
 const intent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
 if(!intent)throw Error('payment_not_complete');
 const payment=await stripe.paymentIntents.retrieve(intent,{expand:['latest_charge','latest_charge.balance_transaction']});
 const p=paidEvidence(order,offer,session,payment);
 return dbResult(db.rpc('record_paid_pick_order',{p_order:p.order,p_checkout:p.checkout,p_payment:p.payment,p_user:p.user,p_offer:p.offer,p_amount:p.amount,p_currency:p.currency,p_live:p.live,p_tax:p.tax,p_fee:payment.latest_charge?.balance_transaction?.currency===p.currency?payment.latest_charge.balance_transaction.fee:null}));
}
export function sameOrigin(req){try{return Boolean(req.headers.origin)&&new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
