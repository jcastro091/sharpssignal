import {billingUser} from '../../../lib/billingServer';
const {verifiedSubscriptionGrant,verifiedQAGrant}=require('../../../lib/realtimeBilling.cjs');
export default async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
 const ctx=await billingUser(req,res);if(!ctx)return;
 const id=req.body?.session_id||req.query.session_id;
 if(typeof id!=='string')return res.status(400).json({ok:false});
 try{
  const session=await ctx.stripe.checkout.sessions.retrieve(id);
  let grant;
  if(session.metadata?.qa_test==='true'){
   if(ctx.user.id!==process.env.QA_CHECKOUT_USER_ID)return res.status(403).json({ok:false});
   grant=await verifiedQAGrant(ctx.stripe,ctx.supabase,id,ctx.user.id);
  }else grant=await verifiedSubscriptionGrant(ctx.stripe,ctx.supabase,id,ctx.user.id);
  return res.json({ok:true,paid:true,expires_at:grant.valid_until,telegramUrl:null,telegram_link_required:true});
 }catch{return res.status(403).json({ok:false,error:'payment_not_verified'});}
}
