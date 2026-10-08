import crypto from 'crypto';
import {realtimeUser} from '../../lib/billingServer';
const {telegram}=require('../../lib/realtimeBilling.cjs');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false});
 const ctx=await realtimeUser(req,res);if(!ctx)return;
 if(!ctx.grant.qa_test||ctx.user.id!==process.env.QA_CHECKOUT_USER_ID)return res.status(403).json({ok:false});
 const destination=process.env.QA_TELEGRAM_CHAT_ID;
 if(!destination)return res.status(503).json({ok:false,error:'verification_destination_required'});
 const delivery_key='qa-payment:'+ctx.grant.stripe_session_id;
 const claim=await ctx.supabase.from('customer_alert_deliveries').insert({delivery_key,stripe_session_id:ctx.grant.stripe_session_id,
  user_id:ctx.user.id,status:'sending',qa_test:true,destination_hash:crypto.createHash('sha256').update(destination).digest('hex')});
 if(claim.error){
  const old=await ctx.supabase.from('customer_alert_deliveries').select('status,provider_message_id').eq('delivery_key',delivery_key).maybeSingle();
  return res.status(old.data?.status==='sent'?200:409).json({ok:old.data?.status==='sent',receipt:old.data?.provider_message_id||null,error:old.data?.status==='sent'?null:'delivery_requires_review'});
 }
 try{
  const sent=await telegram('sendMessage',{chat_id:destination,text:'SHARPSSIGNAL VERIFICATION ONLY\nYour $1 verification payment is confirmed and real-time delivery is connected.\nThis is a labelled test notification, not a betting play or trade.'});
  const write=await ctx.supabase.from('customer_alert_deliveries').update({status:'sent',provider_message_id:sent.message_id,sent_at:new Date().toISOString()}).eq('delivery_key',delivery_key);
  if(write.error)throw new Error('receipt_not_recorded');
  return res.status(200).json({ok:true,receipt:sent.message_id,qa_test:true});
 }catch{
  await ctx.supabase.from('customer_alert_deliveries').update({status:'uncertain'}).eq('delivery_key',delivery_key);
  return res.status(503).json({ok:false,error:'delivery_requires_review'});
 }
}
