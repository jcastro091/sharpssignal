import { randomUUID, createHash } from 'crypto';
import { getCeoAccess } from '../../../lib/ceoAccess';
import { createSupabaseServiceClient } from '../../../lib/supabaseServer';
import {runPickRefundWorker} from '../../../lib/pickRefundWorker';
import {refundStore,sameOrigin,commerceStripe} from '../../../lib/pickCommerceServer';
import { initiate } from '../../../lib/pickRefund.cjs';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
 const access=await getCeoAccess(req,res);
 if(!access.allowed) return res.status(403).json({error:'admin_required'});
 if(req.method==='POST' && !sameOrigin(req)) return res.status(403).json({error:'same_origin_required'});
 const mode=(req.method==='GET'?req.query.mode:req.body?.mode)==='test'?'test':'live';
 const key=mode==='test'?process.env.STRIPE_TEST_SECRET_KEY:process.env.STRIPE_SECRET_KEY;
 const configured=Boolean(key?.startsWith(mode==='test'?'sk_test_':'sk_live_'));
 const db=createSupabaseServiceClient();
 const checked=async promise=>{const r=await promise;if(r.error)throw Error('refund_storage_error');return r.data;};
 try {
  if(req.method==='GET') {
   const purchases=await checked(db.rpc('admin_pick_refund_rows',{p_mode:mode,p_limit:100}));
   const automation=await checked(db.from('pick_fee_automation_state').select('*').eq('billing_mode',mode).maybeSingle());
   return res.json({purchases,configured,mode,automation});
  }
  if(!configured) return res.status(503).json({error:mode==='test'?'stripe_test_key_required':'stripe_live_key_required'});
  const stripe=commerceStripe(mode);
  if(req.body.action==='create_verification_offer') {
   if(mode!=='test')return res.status(400).json({error:'verification_requires_sandbox'});
   let offer=await checked(db.from('pick_fee_offers').select('*').eq('created_by',access.user.id).eq('billing_mode',mode).eq('owner_verification',true).limit(1).maybeSingle());
   if(!offer){offer=await checked(db.from('pick_fee_offers').insert({home_team:'Verification home',away_team:'Verification away',sport:'verification',market:'moneyline',game_time:new Date(Date.now()+7*86400000).toISOString(),billing_mode:mode,owner_verification:true,selection:{side:'home',label:'Verification home moneyline',note:'Synthetic selection for the owner-only payment/reveal/refund test. Not a real wager.'},source:{synthetic:true},created_by:access.user.id}).select().single());}
   return res.json({offer_id:offer.id,url:'/pick-shop?mode='+mode,owner_verification:true});
  }
  if(req.body.action==='settle_verification_loss') {
   const p=await checked(db.from('pick_fee_purchases').select('*').eq('id',req.body.purchase_id).eq('user_id',access.user.id).eq('billing_mode',mode).eq('owner_verification',true).maybeSingle());
   if(!p)throw Error('purchase_not_found');
   const evidence={synthetic:true,scenario:'verified_loss_after_paid_reveal',purchase_id:p.id};
   const saved=await db.from('pick_fee_settlements').insert({pick_id:p.pick_id,billing_mode:mode,result:'loss',verified:true,evidence_hash:createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),source_url:'test://owner-verification',evidence,verified_by:access.user.id});
   if(saved.error&&saved.error.code!=='23505')throw Error('refund_storage_error');
   return res.json({status:'verification_loss_recorded',automation:await runPickRefundWorker(mode,p.pick_id)});
  }
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
  const purchase=await checked(db.from('pick_fee_purchases').select('id').eq('id',req.body.purchase_id).eq('billing_mode',mode).maybeSingle());
  if(!purchase)throw Error('purchase_not_found');
  const store=refundStore(db,access.user.id);
  return res.json(await initiate({purchaseId:req.body.purchase_id,adminId:access.user.id,store,stripe,previewOnly:req.body.action==='preview',refreshOnly:req.body.action==='refresh'}));
 } catch(error) {
  const safe=['purchase_not_found','verified_losing_pick_required','payment_binding_mismatch','captured_undisputed_payment_required','refund_requires_reconciliation','refund_claim_conflict','refund_storage_error','not_a_guaranteed_pick'];
  console.error('pick_refund_failed',error.type||error.code||'internal_error');
  return res.status(400).json({error:safe.includes(error.message)?error.message:'refund_failed'});
 }
}
