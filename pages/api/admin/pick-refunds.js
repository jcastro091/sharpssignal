import Stripe from 'stripe';
import { randomUUID, createHash } from 'crypto';
import { getCeoAccess } from '../../../lib/ceoAccess';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import { initiate } from '../../../lib/pickRefund.cjs';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
 const access=await getCeoAccess(req,res);
 if(!access.allowed) return res.status(403).json({error:'admin_required'});
 if(req.method==='POST' && (!req.headers.origin || new URL(req.headers.origin).host!==req.headers.host)) return res.status(403).json({error:'same_origin_required'});
 const mode=(req.method==='GET'?req.query.mode:req.body?.mode)==='test'?'test':'live';
 const key=mode==='test'?process.env.STRIPE_TEST_SECRET_KEY:process.env.STRIPE_SECRET_KEY;
 const configured=Boolean(key?.startsWith(mode==='test'?'sk_test_':'sk_live_'));
 const db=createSupabaseServiceClient();
 const checked=async promise=>{const r=await promise;if(r.error)throw Error('refund_storage_error');return r.data;};
 try {
  if(req.method==='GET') {
   const purchases=await checked(db.from('pick_fee_purchases').select('id,pick_id,amount_paid_cents,currency,status,created_at').eq('billing_mode',mode).order('created_at',{ascending:false}).limit(100));
   return res.json({purchases,configured,mode});
  }
  if(!configured) return res.status(503).json({error:mode==='test'?'stripe_test_key_required':'stripe_live_key_required'});
  const stripe=new Stripe(key);
  if(req.body.action==='test_purchase') {
   if(mode!=='test') return res.status(400).json({error:'sandbox_only'});
   const id=randomUUID(),pickId='sandbox-loss:'+id;
   const payment=await stripe.paymentIntents.create({amount:500,currency:'usd',payment_method:'pm_card_visa',confirm:true,automatic_payment_methods:{enabled:true,allow_redirects:'never'},metadata:{purchase_id:id,pick_id:pickId,user_id:access.user.id,guarantee_version:'pick_fee_loss_v1'}});
   if(payment.livemode||payment.status!=='succeeded') throw Error('sandbox_payment_not_succeeded');
   await checked(db.from('pick_fee_purchases').insert({id,user_id:access.user.id,pick_id:pickId,payment_intent_id:payment.id,amount_paid_cents:500,currency:'usd',billing_mode:'test',qa_test:true,guarantee_version:'pick_fee_loss_v1',snapshot:{synthetic:true}}));
   const evidence={synthetic:true,scenario:'final_losing_pick',purchase_id:id};
   await checked(db.from('pick_fee_settlements').insert({pick_id:pickId,billing_mode:'test',result:'loss',verified:true,evidence_hash:createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),source_url:'test://stripe-sandbox',evidence,verified_by:access.user.id}));
   return res.json({purchase_id:id,status:'paid',sandbox:true});
  }
  if(!['preview','refund','refresh'].includes(req.body.action)) return res.status(400).json({error:'unknown_action'});
  const store={isAdmin:async id=>id===access.user.id,
   purchase:async id=>checked(db.from('pick_fee_purchases').select('*').eq('id',id).eq('billing_mode',mode).maybeSingle()),
   settlement:async(id,m)=>checked(db.from('pick_fee_settlements').select('*').eq('pick_id',id).eq('billing_mode',m).maybeSingle()),
   existingClaim:async id=>checked(db.from('pick_fee_refund_claims').select('*').eq('purchase_id',id).maybeSingle()),
   claim:async c=>checked(db.rpc('reserve_pick_fee_refund',{p_purchase_id:c.purchase_id,p_admin_id:c.admin_id,p_amount:c.amount_cents,p_evidence_hash:c.evidence_hash})),
   complete:async(id,r)=>checked(db.rpc('complete_pick_fee_refund',{p_claim_id:id,p_refund_id:r.stripe_refund_id,p_status:r.status,p_amount:r.amount,p_total_refunded:r.total_refunded,p_currency:r.currency,p_failure_code:r.failure_code}))};
  return res.json(await initiate({purchaseId:req.body.purchase_id,adminId:access.user.id,store,stripe,previewOnly:req.body.action==='preview',refreshOnly:req.body.action==='refresh'}));
 } catch(error) {
  const safe=['purchase_not_found','verified_losing_pick_required','payment_binding_mismatch','captured_undisputed_payment_required','refund_requires_reconciliation','refund_claim_conflict','refund_storage_error','not_a_guaranteed_pick'];
  console.error('pick_refund_failed',error.type||error.code||'internal_error');
  return res.status(400).json({error:safe.includes(error.message)?error.message:'refund_failed'});
 }
}
