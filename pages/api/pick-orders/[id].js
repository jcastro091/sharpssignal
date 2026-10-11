import {getServerUser} from '../../../lib/authServer';
import {createSupabaseServiceClient} from '../../../lib/supabaseServer';
import {dbResult,commerceStripe} from '../../../lib/pickCommerceServer';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 const user=await getServerUser(req,res);if(!user?.email_confirmed_at)return res.status(401).json({error:'confirmed_account_required'});
 try{
  const db=createSupabaseServiceClient();const p=await dbResult(db.from('pick_fee_purchases').select('*').eq('id',req.query.id).eq('user_id',user.id).maybeSingle());
  if(!p)return res.status(404).json({error:'purchase_not_found'});
  // Each reveal rechecks the actual charge. A reversed/refunded receipt cannot
  // unlock another customer's pick or a current paid selection.
  const payment=await commerceStripe(p.billing_mode).paymentIntents.retrieve(p.payment_intent_id,{expand:['latest_charge']});
  const valid=payment.status==='succeeded'&&payment.metadata?.user_id===user.id&&payment.metadata?.purchase_id===p.id&&payment.metadata?.pick_id===p.pick_id&&payment.livemode===(p.billing_mode==='live')&&payment.amount_received===p.amount_paid_cents&&payment.currency===p.currency&&payment.latest_charge?.captured&&!payment.latest_charge.disputed&&payment.latest_charge.amount_refunded===0;
  const s=await dbResult(db.from('pick_fee_settlements').select('result,status,verified,verified_at').eq('pick_id',p.pick_id).eq('billing_mode',p.billing_mode).maybeSingle());
  const c=await dbResult(db.from('pick_fee_refund_claims').select('status,stripe_refund_id,failure_code,checked_at').eq('purchase_id',p.id).maybeSingle());
  return res.json({id:p.id,pick_id:p.pick_id,amount_paid_cents:p.amount_paid_cents,currency:p.currency,home_team:p.snapshot.home_team,away_team:p.snapshot.away_team,game_time:p.snapshot.game_time,market:p.snapshot.market,owner_verification:p.owner_verification,status:p.status,settlement:s,refund:c,selection:valid?p.snapshot.selection:null,access:valid?'unlocked':'payment_reversed_or_under_review'});
 }catch{return res.status(503).json({error:'order_verification_unavailable'});}
}
