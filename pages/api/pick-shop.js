import {getServerUser} from '../../lib/authServer';
import {getCeoAccess} from '../../lib/ceoAccess';
import {createSupabaseServiceClient} from '../../lib/supabaseServer';
import {commerceStripe,dbResult,verifyPickSession,sameOrigin} from '../../lib/pickCommerceServer';
import {teaser} from '../../lib/pickCommerce.cjs';
import {recentPlayTeaser} from '../../lib/recentPlayTeasers.cjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
 const user=await getServerUser(req,res);
 const access=user?await getCeoAccess(req,res):{allowed:false};
 const mode=(req.method==='GET'?req.query.mode:req.body?.mode)==='test'?'test':'live';
 const db=createSupabaseServiceClient();
 try{
 if(req.method==='GET'){
  if(mode==='test'&&!access.allowed)return res.status(403).json({error:'admin_required'});
  const f=await dbResult(db.from('pick_fee_offers').select('*').eq('active',true).eq('billing_mode',mode).gte('game_time',new Date().toISOString()).order('game_time').limit(50));
  const offers=f.filter(x=>!x.owner_verification||(access.allowed&&x.created_by===user?.id)).map(teaser);
  const orders=user?.email_confirmed_at?await dbResult(db.from('pick_fee_purchases').select('id,pick_id,status,owner_verification').eq('user_id',user.id).eq('billing_mode',mode).order('created_at',{ascending:false}).limit(100)):[];
  let configured=true;try{commerceStripe(mode);}catch{configured=false;}
  const receipts=await dbResult(db.from('telegram_delivery_receipts').select('source_id,sent_at').eq('pipeline','sports_pilot').eq('delivery_kind','natural_alert').eq('status','sent').not('sent_at','is',null).order('sent_at',{ascending:false}).limit(30));
  const latest=[...new Map(receipts.map(r=>[r.source_id,r])).keys()].slice(0,3);
  const records=latest.length?await dbResult(db.from('sports_pilot_alerts').select('pilot_alert_id,away_team,home_team,sport,market,game_time,sent_at').in('pilot_alert_id',latest)):[];
  const recent=latest.map(id=>records.find(p=>p.pilot_alert_id===id)).filter(Boolean);
  return res.json({offers,recent_plays:recent.map(recentPlayTeaser),orders,admin:access.allowed,authenticated:Boolean(user?.email_confirmed_at),configured,mode,live_sales_enabled:process.env.PICK_CHECKOUT_ENABLED==='true'&&process.env.PICK_PROCESSOR_APPROVED==='true'&&process.env.PICK_TAX_READY==='true'&&Boolean(process.env.PICK_STRIPE_TAX_CODE)});
 }
 if(!user?.email_confirmed_at)return res.status(401).json({error:'confirmed_account_required'});
 if(!sameOrigin(req))return res.status(403).json({error:'same_origin_required'});
 if(mode==='test'&&!access.allowed)return res.status(403).json({error:'admin_required'});
 if(req.body.action==='verify'){
  const p=await verifyPickSession(req.body.session_id,user.id,mode);
  return res.json({purchase_id:p.id,status:p.status});
 }
 if(req.body.action!=='checkout')return res.status(400).json({error:'unknown_action'});
 const offer=await dbResult(db.from('pick_fee_offers').select('*').eq('id',req.body.offer_id).eq('billing_mode',mode).maybeSingle());
 if(!offer?.active||Date.parse(offer.game_time)<=Date.now())throw Error('offer_closed');
 if(offer.owner_verification){if(mode!=='test')throw Error('verification_requires_sandbox');if(!access.allowed||offer.created_by!==user.id)throw Error('admin_required');}
 else if(mode==='live'&&!(process.env.PICK_CHECKOUT_ENABLED==='true'&&process.env.PICK_PROCESSOR_APPROVED==='true'&&process.env.PICK_TAX_READY==='true'&&Boolean(process.env.PICK_STRIPE_TAX_CODE)))throw Error('per_pick_sales_not_open');
 let order=await dbResult(db.from('pick_fee_orders').select('*').eq('offer_id',offer.id).eq('user_id',user.id).maybeSingle());
 if(!order){const r=await db.from('pick_fee_orders').insert({offer_id:offer.id,user_id:user.id}).select().single();if(r.error?.code==='23505')order=await dbResult(db.from('pick_fee_orders').select('*').eq('offer_id',offer.id).eq('user_id',user.id).single());else if(r.error)throw Error('commerce_storage_unavailable');else order=r.data;}
 const existing=await dbResult(db.from('pick_fee_purchases').select('id').eq('id',order.id).maybeSingle());
 if(existing)return res.status(409).json({error:'already_purchased',purchase_id:existing.id});
 const stripe=commerceStripe(mode);
 if(order.checkout_session_id){const prior=await stripe.checkout.sessions.retrieve(order.checkout_session_id);if(prior.status==='open')return res.json({url:prior.url,order_id:order.id});if(prior.status==='complete'){await verifyPickSession(prior.id,user.id,mode);return res.json({purchase_id:order.id});}throw Error('checkout_expired_contact_support');}
 if(Date.now()-Date.parse(order.created_at)>22*3600000)throw Error('order_requires_review');
 const metadata={product_type:'pick',purchase_id:order.id,pick_id:offer.id,user_id:user.id,guarantee_version:'pick_fee_loss_v1',owner_verification:String(offer.owner_verification)};
 const origin='https://www.sharps-signal.com';
 const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],customer_email:user.email,client_reference_id:user.id,metadata,payment_intent_data:{metadata},line_items:[{quantity:1,price_data:{currency:offer.currency,unit_amount:offer.price_cents,tax_behavior:'inclusive',product_data:{name:offer.owner_verification?'Sandbox verification — $5 test purchase and refund':offer.away_team+' at '+offer.home_team+' — one pick',...(offer.owner_verification?{}:{tax_code:process.env.PICK_STRIPE_TAX_CODE})}}}],...(offer.owner_verification?{}:{automatic_tax:{enabled:true},billing_address_collection:'required'}),custom_text:{submit:{message:offer.owner_verification?'Sandbox-only $5 test purchase. No real money moves. The synthetic selection is not a wager or a prediction sold to the public. The verification loss step exercises the automatic refund.':'One-time payment. Selection revealed after verified payment. A verified final loss refunds the full amount paid to your original payment method.'}},success_url:origin+'/pick-shop?mode='+mode+'&session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/pick-shop?mode='+mode+'&cancelled=1'}, {idempotencyKey:'pick-checkout:'+order.id});
 if(session.livemode!==(mode==='live'))throw Error('payment_mode_mismatch');
 await dbResult(db.from('pick_fee_orders').update({checkout_session_id:session.id}).eq('id',order.id));
 return res.json({url:session.url,order_id:order.id});
 }catch(error){const allowed=['stripe_test_key_required','stripe_live_key_required','offer_closed','per_pick_sales_not_open','already_purchased','checkout_expired_contact_support','order_requires_review','payment_not_complete','payment_binding_mismatch','admin_required','verification_requires_sandbox'];return res.status(400).json({error:allowed.includes(error.message)?error.message:'pick_checkout_unavailable'});}
}
